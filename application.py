import os
import requests
import time, re

from flask import Flask, jsonify, render_template, request
from flask_socketio import SocketIO, emit

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy_declarative import Base, Pixel

app = Flask(__name__)
app.secret_key = "super secret key"

if not os.getenv("DATABASE_URL"):
  raise RuntimeError("DATABASE_URL is not set")

# Configure session to use filesystem
app.config["SESSION_PERMANENT"] = False
app.config["SESSION_TYPE"] = "filesystem"

engine = create_engine(os.getenv("DATABASE_URL"))
Base.metadata.bind = engine

DBSession = sessionmaker(bind=engine)
session = DBSession()

# Insert a Person in the person table
new_pixel = Pixel(red=255, green=167, blue=209)
session.add(new_pixel)
session.commit()



@app.route("/")
def index():
  return "Hello, world!"



