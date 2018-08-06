import os
import requests
import time, re

from flask import Flask, jsonify, render_template, request
from flask import send_file
from flask_socketio import SocketIO, emit

from PIL import Image

width, height = 1600, 1600

image_name = 'image4.png'

try:
  image = Image.open(image_name)
except:
  image = Image.new('RGBA', (width, height), color=(34, 34, 34,255))
  image.save(image_name)



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

  pixel_index = (y * image.width + x) * 4

  color = tuple(map(int, re.findall('\d+', data['color'])))

  emit('broadcast change pixel', {'color': color, 'index': pixel_index}, broadcast=True)

  image.putpixel((x, y), color)
  image.save(image_name)

  print((int(data['x']), int(data['y'])), color)
