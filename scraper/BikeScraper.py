import requests
import json
from pprint import pprint
import time
import traceback
import sqlalchemy as sqla
from sqlalchemy import create_engine
from sqlalchemy import MetaData
import glob
import os
from pprint import pprint
import simplejson as json
import requests
from IPython.display import display
from datetime import datetime
import pandas as pd
from sqlalchemy.orm import Session
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy_utils import database_exists, create_database
import datetime
from datetime import datetime
import time; time.time()

URI = 'dublinbikes.crtpfm2zxtgd.eu-west-1.rds.amazonaws.com'
PORT = "3306"
DB = "dublinbikes"
USER = "admin"
PASSWORD = "dublinbikes"

WEATHER_API = "http://api.weatherapi.com/v1/current.json?key=77b0c852d8c24f5b935221641232602&q=Dublin&aqi=no"
WEATHER_API_KEY="77b0c852d8c24f5b935221641232602"

URL = "https://api.jcdecaux.com/vls/v1/stations?contract={Dublin}&apiKey={7a295ed2b5da83866ed8ef45a67894cd93302c89}"

JCKEY= '7a295ed2b5da83866ed8ef45a67894cd93302c89'
NAME= 'Dublin'
STATIONS_URI = "https://api.jcdecaux.com/vls/v1/stations"
DETAIL_STATION = "https://api.jcdecaux.com/vls/v1/stations/{42}?contract={Dublin} HTTP/1.1"

#create engine  
engine = create_engine("mysql+mysqldb://{}:{}@{}:{}/{}".format(USER, PASSWORD, URI, PORT, DB), echo=True)

#create database 
if not database_exists(engine.url):
    create_database(engine.url)

sql = """
CREATE DATABASE IF NOT EXISTS dbbikes;
"""
engine.execute(sql)

#create SQL table for STATIC STATION
sql2 = """
CREATE TABLE IF NOT EXISTS station (
address VARCHAR(256),
banking INTEGER,
bike_stands INTEGER,
bonus INTEGER,
contract_name VARCHAR(256),
name VARCHAR(256),
number INTEGER,
position_lat REAL,
position_lng REAL,
status VARCHAR(256)
)
"""

try:
    # res = engine.execute("DROP TABLE IF EXISTS station")
    res = engine.execute(sql2)
    #print(res.fetchall())
except Exception as e:
    print(e)#traceback.format_exc()

#creates availability table 
sql1 = """
CREATE TABLE IF NOT EXISTS availability (

name VARCHAR(256),
status VARCHAR(256),
available_bike_stands INT,
available_bikes INT,
lastUpdate BIGINT
)
"""

try:
    #res = engine.execute("DROP TABLE IF EXISTS availability") #delete later
    res = engine.execute(sql1)
except Exception as e:
    print(e)

#create weather table _test
sql3 = """
CREATE TABLE IF NOT EXISTS weather (
last_updated DATETIME,
temp INTEGER,
windspeed INTEGER,
pressure REAL,
precipitation REAL,
humidity REAL,
feelslike REAL,
wind_dir VARCHAR(256),
weather_condition VARCHAR(256),
local_time VARCHAR(256)
)
"""
try:
    #res = engine.execute("DROP TABLE IF EXISTS weather")
    res = engine.execute(sql3)
except Exception as e:
    print(e)


current_bikes = """
CREATE TABLE IF NOT EXISTS currentBikes (
number INTEGER,
name VARCHAR(256),
status VARCHAR(256),
available_bike_stands INT,
available_bikes INT,
lastUpdate BIGINT
)
"""

try:
    res = engine.execute("DROP TABLE IF EXISTS currentBikes")
    res = engine.execute(current_bikes)
except Exception as e:
    print(e)


#initialize API key for bike data  and weather
r = requests.get(STATIONS_URI, params={'apiKey':JCKEY,'contract':NAME})
z = requests.get(WEATHER_API)

#function to populate static table
def write_to_db_static(text):
         stations  = json.loads(text)
         
         for station in stations:
              vals = (station.get('address'), 
                      int(station.get('banking')), 
                      station.get('bike_stands'), 
                      int(station.get('bonus')), 
                      station.get('contract_name'), 
                      station.get('name'), 
                      station.get('number'), 
                      station.get('position').get('lat'), 
                      station.get('position').get('lng'), 
                      station.get('status')
                      )
              engine.execute("insert into station values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)", vals)

write_to_db_static(r.text)

#function to populate availability table
def write_to_db_available(text):
     wumbo = json.loads(text)
    
     for element in wumbo:
          availability = (
               element.get('name'),
               element.get('status'),
               int(element.get('available_bikes')), 
               int(element.get('available_bike_stands')),
               element.get('last_update'))
          
          engine.execute("insert into availability values(%s,%s,%s,%s,%s)", availability)
  
# write new table to db
def write_to_db_current_bikes(text):
     stations = json.loads(text)
     for bike in stations:
          available_bikes = (
               int(bike.get('number')),
               bike.get('name'),
               bike.get('status'),
               int(bike.get('available_bikes')), 
               int(bike.get('available_bike_stands')),
               bike.get('last_update'))
          
          engine.execute("insert into currentBikes values(%s,%s,%s,%s,%s,%s)", available_bikes)

#populate weather table
def write_to_db_weather_data(text):
    weather = json.loads(text)
    # print(weather_data)
    
    #for element in weather_data:
    weather_data = ( 
        weather.get('current').get('last_updated'),
        weather.get('current').get('temp_c'),
        weather.get('current').get('wind_kph'),
        weather.get('current').get('pressure_mb'),
        weather.get('current').get('precip_mm'),
        weather.get('current').get('humidity'),
        weather.get('current').get('feelslike_c'),
        weather.get('current').get('wind_dir'),
        weather.get("current").get("condition").get("text"),
        weather.get("location").get("localtime")
        )
    engine.execute("insert into weather values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)", weather_data)

def main():
    try:
        now = datetime.now()
        print("API Request", now)

        write_to_db_available(r.text)

        write_to_db_current_bikes(r.text)

        write_to_db_weather_data(z.text)

            #now sleep for 5 minutes
            #time.sleep(5*60) 

    except:
        # if there is any problem, print the traceback
        print (traceback.format_exc())
        return

main()