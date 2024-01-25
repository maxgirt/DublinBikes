from flask import Flask, g, render_template, url_for, jsonify, request
from flask_sqlalchemy import SQLAlchemy
import sqlalchemy as sqla
import config
from sqlalchemy import create_engine
import mysql.connector
from sqlalchemy_utils import database_exists, create_database
import traceback
import sys
import pandas as pd
from sqlalchemy import text
import numpy as np
import pickle
import math
import time
from urllib.parse import unquote
import datetime
from datetime import date


app = Flask(__name__)

# Function to connect to the database using credentials from the config module
def connect_to_database():
    engine = create_engine("mysql://{}:{}@{}:{}/{}".format(config.USER, config.PASSWORD, config.URI, config.PORT, config.DB), pool_size=120, max_overflow=20, echo=True)
    try:
        conn = engine.connect()
        print("Successfully connected to the database!")
        return conn
    except Exception as e:
        print("Error connecting to the database:", e)
        print(traceback.format_exc())  # Add this line to print the full traceback of the error
        return None

# Function to get the database connection or create one if it doesn't exist
def get_database():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = connect_to_database()
    return db

@app.route('/')
# Render the main page template and pass the API key from the config module
def index():
    return render_template('index.html', apikey=config.APIKEY)

# Close the database connection when the app context is torn down
@app.teardown_appcontext
def close_database(exception):
    db = getattr(g, '_database',None)
    if db is not None:
        db.close()

@app.route("/realtime")
def get_stations_and_availability():
    engine = get_database()
    data = []
    rows = engine.execute("""
        SELECT
            s.*,
            cb.available_bikes,
            cb.lastUpdate
        FROM
            station s
        JOIN
            currentBikes cb ON s.number = cb.number;
    """)
    for row in rows:
        data.append(dict(row))
    return jsonify(stations=data)


# Route to fetch the availability data for a given bike station number
@app.route("/available/<int:number>")
def get_available_bikes(number):
    try:
        engine = get_database()
        data = []
        # Use a parameterized query to prevent SQL injection
        query = text("SELECT * FROM currentBikes WHERE number = :number")
        rows = engine.execute(query, number=number)
        for row in rows:
            data.append(dict(row))
        return jsonify(available=data)
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": "An error occurred while fetching the availability data."}), 500

# Route to fetch all bike stations
@app.route("/stations")
def get_stations():
    engine = get_database()
    sql = sqla.text("SELECT * FROM station")
    try:
        rows = engine.execute(sql).fetchall()
        print('#found {} stations', len(rows), rows)
        return jsonify([row._asdict() for row in rows])
    except Exception as e:
        print(traceback.format_exc())
        return "Error in get_stations: {}".format(str(e)), 404

# Route to fetch all weather data
@app.route("/weather")
def get_weather():
    engine = get_database()
    data = []
    rows = engine.execute("SELECT * FROM weather ORDER BY last_updated DESC LIMIT 1")
    for row in rows:
        data.append(dict(row))
    return jsonify(available=data)

def adhocWeatherRequest(integer):
    engine = get_database()
    if 0 <= integer <= 24:
        if 0 <= integer <= 7:
            time_range = "'00:00:00' AND '06:00:00'"
        elif 8 <= integer <= 13:
            time_range = "'06:00:00' AND '12:00:00'"
        elif 14 <= integer <= 19:
            time_range = "'12:00:00' AND '18:00:00'"
        else:
            time_range = "'18:00:00' AND '24:00:00'"
        sql = f"""
            SELECT humidity, precipitation, windspeed, temp 
            FROM weather 
            WHERE TIME(local_time) BETWEEN {time_range};
            """
        result = engine.execute(sql).fetchall()
        
        temp = []
        prec = []
        wsp = []
        hum= []

        for t in result:
            hum.append(t[0])
            prec.append(t[1])
            wsp.append(t[2])
            temp.append(t[3])
        
        w = np.mean(hum)
        x = np.mean((prec))
        y = np.mean((wsp))
        z = np.mean((temp))

        weatherArray = [w,x,y,z]
        return weatherArray

@app.route("/adhocBikeRequest/<int:number>")
def adhocBikeRequest(number):
    engine = get_database()
    sql = f"""
        SELECT a.*, cb.number
        FROM availability a
        JOIN currentBikes cb ON a.name = cb.name
        WHERE cb.number = {number}
        """
    result = engine.execute(sql).fetchall()

    data = []
    timedata = []
    dailydata = []

    rightnow = datetime.datetime.fromtimestamp(time.time())
    rightnow = rightnow.strftime("%H")
    rightnow = str(rightnow)

    today = datetime.datetime.fromtimestamp(time.time())
    today = today.strftime("%A")

    for row in result:

        # needs ms to use datetime method.
        dayofweek = row[4]/1000
        dayofweek = datetime.datetime.fromtimestamp(dayofweek)
        dayofweek = dayofweek.strftime("%A")

        hourofday = row[4]/1000
        hourofday = datetime.datetime.fromtimestamp(hourofday)
        hourofday = hourofday.strftime("%H")
        hourofday = str(hourofday)

        if hourofday == rightnow:

            item = {
                'name': row[0],
                'lastUpdate': row[4],
                'availability': row[2],
                'bike_stands_capacity': row[3],
                'number': row[5],
                'dayofweek' : dayofweek,
                'hour': hourofday
            }
            timedata.append(item)

        if today == dayofweek:

            item = {
                'name': row[0],
                'lastUpdate': row[4],
                'availability': row[2],
                'bike_stands_capacity': row[3],
                'number': row[5],
                'dayofweek' : dayofweek,
                'hour': hourofday
            }
            dailydata.append(item)
    
    print(len(timedata))
    print(len(dailydata))

    data.append(timedata)
    data.append(dailydata)
    
    return jsonify(data)


# gets data from form and uses model to predict bike availability
@app.route('/predict', methods=['POST'])
def predict():
    # Get input values from the JSON data
    data = request.get_json()
    day = int(data['day'])
    hour = int(data['hour'])
    station = str(data['station'])
    weatherarray = adhocWeatherRequest(hour)

    hum =weatherarray[0]
    precip = weatherarray[1]
    windspeed = weatherarray[2]
    temp = weatherarray[3]

    # Convert input data to a numpy array and reshape it
    input_data = np.array([day,hour,hum,precip,windspeed,temp]).reshape(1, -1)
    # Load the model from the file
    with open(f'./model/{station}_model.pkl', 'rb') as f:
        model = pickle.load(f)

    # Make predictions using the saved model
    predictions = model.predict(input_data)
    math.floor(predictions)
    print('this is our prediction:', predictions)
    return {'prediction': str(predictions[0])}  # return the prediction
    
# Run the Flask application in debug mode
if __name__ == "__main__":
    app.run(debug=True)