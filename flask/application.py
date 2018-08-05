import os
import requests
import time, re

from flask import Flask, jsonify, render_template, request
from flask import send_file
from flask_socketio import SocketIO, emit

from PIL import Image

width, height = 300, 300

try:
  image = Image.open('image.1.png')
except:
  image = Image.new('RGB', (width, height))
  image.save('image.1.png')



app = Flask(__name__)
socketio = SocketIO(app)

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
  color = tuple(map(int, re.findall('\d+', data['color'])))

  emit('broadcast change pixel', {'x': x, 'y': y, 'color': color}, broadcast=True)

  image.putpixel((x, y), color)
  image.save('image.png')

  print((int(data['x']), int(data['y'])), color)
