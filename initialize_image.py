import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy_declarative import Base, Pixel

engine = create_engine(os.getenv("DATABASE_URL"))
Base.metadata.bind = engine

DBSession = sessionmaker(bind=engine)
session = DBSession()

width = int(os.getenv("IMAGE_WIDTH"))
height = int(os.getenv("IMAGE_HEIGHT"))

WHITE = (255, 255, 255)
LIGHT_GRAY = (228, 228, 228)
GRAY = (136, 136, 136)
BLACK = (0, 0, 0)
PINK = (255, 167, 209)
RED = (229, 0, 0)
ORANGE = (229, 149, 0)
BROWN = (160, 106, 66)
YELLOW = (229, 217, 0)
LGREEN = (148, 224, 68)
GREEN = (2, 190, 1)
AQUA_BLUE = (0, 211, 221)
GREEN_BLUE = (0, 131, 199)
BLUE = (0, 0, 234)
VIOLET = (207, 110, 228)
PURPLE = (130, 0, 128)


def make_pixel(color, x, y):
  return Pixel(red=color[0], green=color[1], blue=color[2], x=x, y=y)

print('inserting pixels')
for y in range(height):
  for x in range(width):
    new_pixel = make_pixel(BLACK, x, y)
    session.add(new_pixel)
session.commit()
print('done')