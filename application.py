import os
import requests
import time, re

from flask import Flask, jsonify, render_template, request
from flask import send_file
from flask_socketio import SocketIO, emit

from sqlalchemy import create_engine
from sqlalchemy.orm import scoped_session, sessionmaker

from PIL import Image

width, height = 1600, 1600

image_name = 'image4.png'

try:
  image = Image.open(image_name)
except:
  image = Image.new('RGBA', (width, height), color=(34, 34, 34, 255))
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



def update_user_count():
  db.execute("UPDATE users SET logged_in = FALSE WHERE 'now' - last_accessed_time > interval '00:15:00'")
  db.commit()

def user_count():
  return db.execute("SELECT * FROM users WHERE logged_in").rowcount

def send_user_count():
  emit('send user count', {'user_count': user_count()}, broadcast=True)

@app.route('/')
def index():
  return render_template('index.html')

@socketio.on('request image')
def broadcast_message():
  emit('send image', {'buffer': image.tobytes(), 'width': image.width, 'height': image.height})
  print('sent image')

@socketio.on('change pixel')
def change_pixel(data):
  x, y = int(data['x']), int(data['y'])

  pixel_index = (y * image.width + x) * 4

  color = tuple(map(int, re.findall('\d+', data['color'])))

  emit('broadcast change pixel', {'color': color, 'index': pixel_index}, broadcast=True)

  image.putpixel((x, y), color)
  image.save(image_name)

  print((int(data['x']), int(data['y'])), color)

  # db.execute("UPDATE users SET last_accessed_time = 'now' WHERE id = :id", {'id': data['id']})
  # db.commit()



@socketio.on('request new user id')
def create_new_user():
  insertion = db.execute("INSERT INTO users (creation_time, last_accessed_time, logged_in) VALUES ('now', 'now', TRUE) RETURNING id")
  db.commit()
  user_id = list(insertion)[0][0]
  emit('give new user id', {'id': user_id})

  update_user_count()
  send_user_count()

@socketio.on('enter site')
def record_enter_site(data):
  db.execute("UPDATE users SET logged_in = TRUE, last_accessed_time = 'now' WHERE id = :id", {'id': data['id']})
  db.commit()

  update_user_count()
  send_user_count()

@socketio.on('exit site')
def record_exit_site(data):
  db.execute("UPDATE users SET logged_in = FALSE WHERE id = :id", {'id': data['id']})
  db.commit()
  send_user_count()


@socketio.on('exit tab')
def exit_tab():
  print('a user exited a tab')

@socketio.on('enter tab')
def exit_tab():
  print('a user entered a tab')