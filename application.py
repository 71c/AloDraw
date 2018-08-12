import os
import requests
import time, re

from flask import Flask, jsonify, render_template, request
from flask import send_file
from flask_socketio import SocketIO, emit

from sqlalchemy import create_engine
from sqlalchemy.orm import scoped_session, sessionmaker

from PIL import Image

from threading import Timer

width, height = 3000, 3000

chunk_size = 512

last_pixel_change_time = time.time()
counter = 0
pixel_changes = []

image_name = 'image11.png'

try:
  image = Image.open(image_name)
except:
  image = Image.new('RGBA', (width, height), color=(34, 34, 34))
  image.save(image_name)

app = Flask(__name__)
socketio = SocketIO(app)

# Check for environment variable
if not os.getenv("DATABASE_URL"):
    raise RuntimeError("DATABASE_URL is not set")

# Configure session to use filesystem
app.config["SESSION_PERMANENT"] = False
app.config["SESSION_TYPE"] = "filesystem"

engine = create_engine(os.getenv("DATABASE_URL"))
db = scoped_session(sessionmaker(bind=engine))

# I found this function which is a Python equivalent of the JavaScript setInterval at https://stackoverflow.com/a/14035296/9911203
def set_interval(func, sec):
    def func_wrapper():
        set_interval(func, sec)
        func()
    t = Timer(sec, func_wrapper)
    t.start()
    return t

# if anyone isn't active for 15 minutes, count them as not online
def update_user_count():
  db.execute("UPDATE users SET logged_in = FALSE WHERE 'now' - last_accessed_time > interval '00:15:00'")
  db.commit()

# broadcast and save changes to the image, then clear the changes and reset the counter
def commit_pixel_changes():
  global pixel_changes
  global counter

  if len(pixel_changes) > 0:
    emit('broadcast change pixels', {'pixel_changes': pixel_changes}, broadcast=True)
    for change in pixel_changes:
      image.putpixel((change['x'], change['y']), change['color'])
    image.save(image_name)
    pixel_changes = []
    counter = 0

update_user_count()
# update the user count every 15 minutes
set_interval(update_user_count, 900)

commit_pixel_changes()

def user_count():
  return db.execute("SELECT * FROM users WHERE logged_in").rowcount

def send_user_count():
  emit('send user count', {'user_count': user_count()}, broadcast=True)

@app.route('/')
def index():
  return render_template('index.html', x=0, y=0)

@app.route('/<int:x>,<int:y>')
def go_to(x, y):
  return render_template('index.html', x=x, y=y)

@socketio.on('request chunks')
def send_image(data):
  chunks = []
  for chunk in data['chunks']:
    chunk['buffer'] = image.crop(chunk['rectangle']).tobytes()
    chunks += [chunk]
  emit('send chunks', {'chunks': chunks})

# when a user places a pixel
@socketio.on('change pixel')
def change_pixel(data):
  global pixel_changes
  global last_pixel_change_time
  global counter

  x, y = data['x'], data['y']
  color = tuple(data['color'])
  pixel_changes.append({'color': color, 'x': x, 'y': y})

  # if the time since the last recieved pixel change is less that 1.5 seconds,
  # add 1 to the counter
  if time.time() - last_pixel_change_time < 1.5:
    counter += 1
  else:
    counter = 0

  last_pixel_change_time = time.time()

  # when recieving rapid changes, change the image and broadcast the changes in batches of 10.
  # otherwise, save and broadcast every change.
  # This method pervents the server from taking too long and thus making the Heroku app crash.
  if counter == 0 or counter >= 10:
    commit_pixel_changes()

# when a new user enters the site, they request the next id from the users table
# so they can put that number into their localStorage.
@socketio.on('request new user id')
def create_new_user(user_info):
  insertion = db.execute("INSERT INTO users (creation_time, last_accessed_time, logged_in, browser, user_agent) VALUES ('now', 'now', TRUE, :browser, :user_agent) RETURNING id", user_info)
  db.commit()
  user_id = list(insertion)[0][0]
  emit('give new user id', {'user_id': user_id})
  send_user_count()

# when an already identified user enters the site, record that in the database and tell everyone
@socketio.on('enter site')
def record_enter_site(data):
  db.execute("UPDATE users SET logged_in = TRUE, last_accessed_time = 'now' WHERE id = :id", {'id': data['user_id']})
  db.commit()
  send_user_count()
  commit_pixel_changes()

# when a user exits the site, record that in the database and tell everyone
@socketio.on('exit site')
def record_exit_site(data):
  db.execute("UPDATE users SET logged_in = FALSE WHERE id = :id", {'id': data['user_id']})
  db.commit()
  send_user_count()
  commit_pixel_changes()

# tell user width and height of the image, as well as the chunk size.
@socketio.on('request image dimensions')
def give_dimensions():
  emit('give image dimensions', {'width': image.width, 'height': image.height, 'chunk_size': chunk_size})
