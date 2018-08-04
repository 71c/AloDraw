import os
import sys


from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy import create_engine

Base = declarative_base()

class Pixel(Base):
  __tablename__ = 'pixel'
  id = Column(Integer, primary_key=True)
  red = Column(Integer, nullable=False)
  green = Column(Integer, nullable=False)
  blue = Column(Integer, nullable=False)
  x = Column(Integer, nullable=False)
  y = Column(Integer, nullable=False)


if not os.getenv("DATABASE_URL"):
  raise RuntimeError("DATABASE_URL is not set")
# Set up database
engine = create_engine(os.getenv("DATABASE_URL"))
# Create all tables in the engine
Base.metadata.create_all(engine)
