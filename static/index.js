var markers = [];
var currentInfoWindow = null;
var displayAvailable = true;
var user_location;
var destination_location;
var bikeStations = [];
var directionsRenderer;
var availabilityData = {}; // Object to store availability data for each marker
var stationHistory = [];
var chart;
var chart2;
var chart3;
var chart2loaded = false;
var chart3loaded = false;

function updateMarkerImages() {
  for (var i = 0; i < markers.length; i++) {
    var marker = markers[i];

    // if displayAvailable is true then available bikes is shown, otherwise we show bike stands -------- available bike stands is always passed through the function regardless if its true or false 
    if (marker.station_number === undefined) {
      continue;
    }

    var availability = availabilityData[marker.station_number];
    var image = createMarkerImage(displayAvailable ? availability.available_bikes : availability.available_bike_stands, availability.available_bike_stands);
    marker.setIcon(image);
    // marker.infowindow.setContent(`<div><strong>${marker.title}</strong><br><span>${displayAvailable ? "Available Bikes" : "Bike Stands"}: ${displayAvailable ? availability.available_bikes : availability.available_bike_stands}</span></div>`);
  }
}



//create marker image  and takes a single paramater which is the text being displayed on the image (number of bikes)
function createMarkerImage(available, capacity) {

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = 32;
  canvas.height = 32;

  context.beginPath();
  context.arc(16, 16, 14, 0, 2 * Math.PI, false); //create a circle shape for our icons


//if displayAvailable: then do this

  if (displayAvailable) {
    //if the text  is === to 0 then we set the color of the icon to grey 
    if (available === 0) {
      context.fillStyle = '#a9a9a9';
      context.fill();
      // if the text is not 0 then we set the color to blue
    } else { 
      context.fillStyle = '#1774DE'; 
      context.fill();
    }
    context.font = '12px Inter';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = 'white';
    context.fillText(available, 16, 16); //text is drawn in center of circle  
  }

  else {
    //if the text  is === to 0 then we set the color of the icon to grey 
    if (capacity === 0) {
      context.fillStyle = '#a9a9a9';
      context.fill();
      // if the text is not 0 then we set the color to blue
    } else { 
      context.fillStyle = '#1774DE'; 
      context.fill();
    }
    context.font = '12px Inter';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = 'white';
    context.fillText(capacity, 16, 16); //text is drawn in center of circle  
  }

  // converts canvas to a dataURL which gets us the image of the map icon  
  const dataUrl = canvas.toDataURL();

  //returns an object with properties url, size, origin, and anchor, which can be used to create a new marker object in Google Maps.
  return {
    url: dataUrl,
    size: new google.maps.Size(32, 32),
    origin: new google.maps.Point(0, 0),
    anchor: new google.maps.Point(16, 16),
  };
}

function createStationMarker(station, availability) {

  //creates a marker object using googlemaps marker consturctor --> initilized with an animation, position, station,name, and station number
  var marker = new google.maps.Marker({
    animation: google.maps.Animation.DROP,
    position: {
      lat: station.position_lat,
      lng: station.position_lng,
    },
    map: map,
    title: station.name,
    station_number: station.number,
    icon: createMarkerImage(availability.available_bikes, availability.available_bike_stands), //calls our function which creates the image and puts the number on for our markers
  });

  //creates a window which displays the name of the station in marker.title and the number of available bikes in availability 
  var infowindow = new google.maps.InfoWindow({
    content: `<div><strong>${marker.title}</strong><br><span>Available Bikes: ${availability.available_bikes}</span></div>`,
  });

  marker.infowindow = infowindow;
  markers.push(marker); //adds the marker to an array called markers 

  //an event listener --> when the marker is clicked we call the getAvailable() function 
  marker.addListener("click", function () {
    getAvailable(this.station_number, marker),
    fetch(`/adhocBikeRequest/${this.station_number}`)
      .then(response => response.json())
      .then(data => {
        if(stationHistory.length > 0){
          stationHistory = [];
        }
        stationHistory.push(data);

        populateChartDay(stationHistory);
        populateChartHour(stationHistory); 
      })
  });
  
  // Store availability data for this marker in global variable
  availabilityData[marker.station_number] = availability;
  };



//shows all the stations on the map by calling the createStationMarker function for each station
function showStations(stations) {
  stations.forEach((station) => {
    createStationMarker(station, { //create new marker on the map with the stations available bikes and last update when clicked
      available_bikes: station.available_bikes,
      available_bike_stands: station.bike_stands - station.available_bikes,
      last_update: station.last_update,
    });
  });
}

// The getAvailable function fetches the availability data for a station by its ID and passes it to the showAvailable function
//takes 2 markers --> id of station and marker on the map 
function getAvailable(id, marker) {
  fetch("/available/" + id)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Server error: " + response.status);
      }
      return response.json();
    })
    .then((data) => {
      showAvailable(data, marker); //calls showAvailable function if response is succesfull and passes through data and marker
    })
    .catch((error) => {
      console.error("Error fetching bike availability:", error);
    });
}

//this function is linked to the endpoint of /realtime on our website so when it reaches that endpoint it calls a json object of the bike station and we push that into bikeStations array
function realtime() {

  return fetch("/realtime")
    .then((response) => response.json())
    .then((data) => {
      showStations(data.stations); //if data is returned we call showStations
      bikeStations.push(data.stations);
      return data.stations; // Add this line to return the list of stations
    })
  }
//this code should be moved before getAvailable()
//This function shows Available bikes at each station and the name of the station
function showAvailable(station, marker) {

  var realTime = new Date(station.available[0].lastUpdate).toLocaleTimeString("en-GB"); //converts lastupdate to a human readable time format
  //contentString holds the name and available bikes of the appropriate station  and is passed into the infowindow
  var contentString = `<div class="map-box"><strong>${station.available[0].name}</strong><br><span>Available Bikes: ${station.available[0].available_bikes}</span><br>Available Bike Stands: ${station.available[0].available_bike_stands}</span><br><span>Last Updated: ${realTime}</div>`;  var infowindow = new google.maps.InfoWindow({
    content: contentString,
  });

  if (currentInfoWindow) {
    currentInfoWindow.close();
  }

  //infowindow object is assigned to currentInfoWindow, and it is opened on the map at the location of the 
  //marker using the open() method
  currentInfoWindow = infowindow;
  infowindow.open(map, marker);
}

//function that gets the weather data from the weather api via app.py and the server endpoint /weather 
function getWeather() {
  fetch("/weather")
    .then((response) => {
      if (!response.ok) {
        throw new Error("Server error: " + response.status);
      }
      return response.json();
    })
    .then((data) => {
      //assigns the weather object to a new variable 
      const weatherRN = data.available[data.available.length - 1];

      displayLatestWeatherRecord(weatherRN); //calls new function to display weather info
    })
    .catch((error) => {
      console.error("Error fetching weather data:", error);
    });
}

//sets up the google maps and initializes various components of our app 
function initMap() {
  const dublin = { lat: 53.350140, lng: -6.266155 }; //assigns a variable to lat/long points which will decide where our map starts
  //creates a new google map using the  Map() consturctor and passes in options to set up how it will look like 
  map = new google.maps.Map(document.getElementById("map"), {
    zoom: 13.4,
    center: dublin, //our map centers around the center of dublin 
    disableDefaultUI: true, // disables all default UI elements
    styles: [
      {
        featureType: "poi",
        elementType: "labels",
        stylers: [
          {
            visibility: "off",
          },
        ],
      },
      {
        featureType: "transit",
        elementType: "labels",
        stylers: [
          {
            visibility: "off",
          },
        ],
      },
      {
        featureType: "road",
        elementType: "labels.icon",
        stylers: [
          {
            visibility: "off",
          },
        ],
      },
      {
        featureType: "road",
        elementType: "geometry",
        stylers: [
          {
            visibility: "simplified",
          },
        ],
      },
    ],
  });
//call realtime function to retrieve latest bikestation data and display it on the map
  realtime()
  .then((stations) => {
    let station_names = "";
//for each station assign station number and station address to station names 
    stations.forEach((station) => {
      station_names += "<option value='" + station.number + "'>" + station.address + "</option>";
    });
// replace "station" in the html with the drop down menu? 
    document.getElementById("Station").innerHTML = station_names;
  });

//delays execution of weather function by 1000 ms or 1 second
  setTimeout(() => {
    getWeather();
  }, 1000);
    
 //sets up autocomplete in the search box for destination and user location
 //componenet restriction restricts the results to be specifically in ireland  
  user_location = new google.maps.places.Autocomplete(document.getElementById('user_location'),  {
    types: ['geocode'],
    componentRestrictions: {country: 'IE'}
  });
  destination_location = new google.maps.places.Autocomplete(document.getElementById('destination'), {
    types: ['geocode'],
    componentRestrictions: {country: 'IE'}
  });

  // Add an event listener for the 'idle' event, and call getUserLocation only once when the map becomes idle for the first time
  const idleListener = google.maps.event.addListener(map, 'idle', () => {
  getUserLocation();
  // Remove the listener after the first execution
  google.maps.event.removeListener(idleListener);
  });
}


//finds the closest bikestation to the users location
function findClosest() {

  //clear any existing directions on the map (remove routes, waypoints)
  clearDirections();

  //uses google maps getPlace function to get the users_location and their destination
  const userPlace = user_location.getPlace();
  const destinationPlace = destination_location.getPlace();

  //converts the users location and destination lat and lng into google maps LatLng objects 
  const userLocation = new google.maps.LatLng(userPlace.geometry.location.lat(), userPlace.geometry.location.lng());
  const destination = new google.maps.LatLng(destinationPlace.geometry.location.lat(), destinationPlace.geometry.location.lng());
  

  fetch("/realtime")
    .then((response) => response.json())
    .then((data) => {
      const bikeStations = data.stations;
      const distances_to_user = [];
      const distances_to_dest = [];

      //for each station in bikestations we will compute the distance between the user_location and station_location
      // distance between user location and station location is stored in the distance variable
      bikeStations.forEach((station) => {
        const stationLocation = new google.maps.LatLng(station.position_lat, station.position_lng);
        const distance = google.maps.geometry.spherical.computeDistanceBetween(userLocation, stationLocation);

        //if the amount of available bikes in the station is greater than 0 then this is an appropriate station to pick bikes from
        if (station.available_bikes > 0) {
          distances_to_user.push({ station: station, distance: distance });
        }

        //if  the available bikes are equal to or greater than 0 and the bike stands are not full then use that station for directions
        if (station.available_bikes >= 0 && station.available_bikes != station.bike_stands) {
          distances_to_dest.push({ station: station, distance: distance });
        }
      });

      //sort the distance to users by ascending order and then take the first one (smallest distance)
      distances_to_user.sort((a, b) => a.distance - b.distance);
      const closestStationToUser = distances_to_user[0].station;

      //for each element in the distance_to_dest array we compute the distance between the bike station and the users destination
      distances_to_dest.forEach((distance) => {
        const stationLocation = new google.maps.LatLng(distance.station.position_lat, distance.station.position_lng);
        const distanceToDestination = google.maps.geometry.spherical.computeDistanceBetween(destination, stationLocation);
        distance.distanceToDestination = distanceToDestination;
      });

      //finds closest distance to destination from station 
      distances_to_dest.sort((a, b) => a.distanceToDestination - b.distanceToDestination);
      const closestStationToDestination = distances_to_dest[0].station;
      
      //hides unused bike stations that are not relevant to the stations for the trip
      hideUnusedStations(closestStationToUser, closestStationToDestination);
      
      //function that generates directions for user 
      getDirections(userLocation, new google.maps.LatLng(closestStationToUser.position_lat, closestStationToUser.position_lng),new google.maps.LatLng(closestStationToDestination.position_lat, closestStationToDestination.position_lng), destination );
    });
}
      
//function that generates directions for user by requesting and rendering directions on the map
//takes 4 paramaters where waypoint1/2 are our stations
function getDirections(origin, waypoint1, waypoint2, destination) {

  //the directionsservice call creates an object from the google maps api
  var directionsService = new google.maps.DirectionsService();
  //creates a directionsRenderer object to show it on the map
  directionsRenderer = new google.maps.DirectionsRenderer({map: map});

  //removes previous info held in the realtimeinfobox / hides realtimeinfobox
  if (document.getElementById('realtimeinfobox')) {
    document.getElementById('realtimeinfobox').parentNode.removeChild(document.getElementById('realtimeinfobox'))
  }


  //create the id for realtimeinfo box and then style it (realtime info is how long it takes to get to each waypoint)
  var bikewindow = document.createElement('div');
  bikewindow.id = 'realtimeinfobox';
  // bikewindow.style = 'position: absolute; top: 20px; right: 20px; background-color: #00030D; border: 0px solid black; border-radius: 5px;';
  var sidebar = document.querySelector('.sidebar');
  sidebar.appendChild(bikewindow); 

  function updateBikewindow(text,order) {
    var p = document.createElement('p');
    p.style = "font-size: 12px; font-weight:400"
    p.innerHTML = text;
    bikewindow.appendChild(p);
  }

// generates walking route from origin to waypoint 1 and from waypoint 2 to destination
  directionsService.route(
    {
      origin: origin,
      waypoints: [{ location: waypoint1 }, { location: waypoint2}],
      destination: destination,
      travelMode: google.maps.TravelMode.WALKING,
    },
    (result, status) => {
      if (status === google.maps.DirectionsStatus.OK) {
        directionsRenderer.setDirections(result);

        var legs = result.routes[0].legs;

        for (var i = 0; i < legs.length; i++) {

          var leg = legs[i];

          if (i === 1) {

            duration = leg.duration.value
            duration = (duration/60)/3 //divide by three to estimate how long it takes to bike
            duration = Math.floor(duration);
            duration = duration + ' mins'

          }
          else{
            duration = leg.duration.text;  
          }
          
          updateBikewindow('Time to waypoint ' + (i + 1) + ': ' + '<br><b>' + duration + '</b>');
        }

      } else {
        console.error("Error getting directions:", status);
      }
    }
  );
}

//function that hides stations that aren't being used
//checks to see if the station number is the closeststationtouser or the closeststationtodestination
//if the stations numbers do not match up they are set to null and removed from the map using setMap(null)
function hideUnusedStations(closestStationToUser, closestStationToDestination) {

  for (let i in markers) {
    if (markers[i].station_number === closestStationToUser.number || markers[i].station_number === closestStationToDestination.number) {
      markers[i].setMap(map);
    }
    else {
      markers[i].setMap(null);
    }
  }
}

//function that shows all markers on the map
//iterations through bikeStations and for each element in Bikestations it drops a marker on the map 
function showAllMarkers() {
  const bikeStations = data.stations;
  bikeStations.forEach((station) => {
    station.marker.setMap(map);
  });
}

//function that creates markers for each station in the station array 
function addMarkers(stations) {
  stations.forEach((station) => {
    const marker = new google.maps.Marker({
      position: new google.maps.LatLng(station.latitude, station.longitude),
      map: map,
      title: station.name,
    });
  });
}

//function that removes directions from the map by setting the directionsrender 
function clearDirections() {
  if (directionsRenderer) {
    directionsRenderer.setMap(null);
    directionsRenderer = null;
  }
}

//function that resets the map by clearing directions and calling initMap again to reinitalize everything on our map 
function resetMap(){

  let resetUser = document.getElementById('user_location');
  let resetDest = document.getElementById('destination');
  let resetBikeWindow = document.getElementById('realtimeinfobox');

  if (resetUser.value !=""){
    resetUser.value = "";
  }
  
  if (resetDest.value != ''){
    resetDest.value = ''
  }

  resetBikeWindow.innerHTML = '';

  clearDirections();
  initMap();

}


//function that removes markers by setting each markers visibility to false  
function removeMarker(markers){
  markers.forEach((marker) => {
    marker.setVisible(false)
  });
}



//sends a POST request to the Flask backend with data containing the day, hour, and station values obtained from an HTML form
//in order to return a prediction 
async function getPrediction() {
  // Get input values from the form
  const day = document.getElementById('day').value;
  const hour = document.getElementById('hour').value;
  const station = document.getElementById('Station').value;

  // Create a json object containing the input values
  const data = {
    day: day,
    hour: hour,
    station: station
  };

  // Send the data to the Flask backend using a POST request
  // The data is sent as a JSON string in the request body
  const response = await fetch('/predict', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
  });

  // Parse the JSON data from the response
  const result = await response.json();
  parseInt(result.prediction);
  testresult = Math.floor(result.prediction);
  // Update the frontend with the prediction string
  // This displays the prediction result to the user
  const predictionElement = document.getElementById('prediction');
  predictionElement.textContent = 'Predicted amount of available bikes: ' + testresult;
  populateChart();
}

// Add event listener to "Available Bikes" button
document.getElementById("available_bikes").addEventListener("click", function() {
  displayAvailable = true;
  updateMarkerImages();
});

// Add event listener to "Bike Stands" button
document.getElementById("bike_stands").addEventListener("click", function() {
  displayAvailable = false;
  updateMarkerImages();
});

function getUserLocation() {
  document.getElementById('location-info').style.display = 'none';

  // Hardcode user's latitude and longitude
  const userPosition = new google.maps.LatLng(
    53.307433634305646, // Replace with your desired latitude
    -6.218645225503011 // Replace with your desired longitude
  );

  // Create and place a Blue marker on the user's location
  var userMarker = createBlueMarker(userPosition);

  markers.push(userMarker);

  fetch("/realtime")
    .then((response) => response.json())
    .then((data) => {
          const bikeStations = data.stations;
          const distances_to_user = [];
          const distances_to_dest = [];

          //for each station in bikestations we will compute the distance between the user_location and station_location
          // distance between user location and station location is stored in the distance variable
          bikeStations.forEach((station) => {
            const stationLocation = new google.maps.LatLng(station.position_lat, station.position_lng);
            const distance = google.maps.geometry.spherical.computeDistanceBetween(userPosition, stationLocation);

            //if the amount of available bikes in the station is greater than 0 then this is an appropriate station to pick bikes from
            if (station.available_bikes > 0) {
              distances_to_user.push({ station: station, distance: distance });
            }

            //if  the available bikes are equal to or greater than 0 and the bike stands are not full then use that station for directions
            if (station.available_bikes >= 0 && station.available_bikes != station.bike_stands) {
              distances_to_dest.push({ station: station, distance: distance });
            }
          });

          //sort the distance to users by ascending order and then take the first one (smallest distance)
          distances_to_user.sort((a, b) => a.distance - b.distance);
          const closestStationToUser = distances_to_user[0].station;

          //  Create a marker for the nearest bike station 
          var nearestBikeMarker = new google.maps.Marker({ 
          position: new google.maps.LatLng(closestStationToUser.position_lat, closestStationToUser.position_lng), 
          map: map,
          icon: {
            url: '/static/man-biking-medium-skin-tone-svgrepo-com.svg',
            scaledSize: new google.maps.Size(50, 80),
            anchor: new google.maps.Point(60, 50),
          },
      
        });
        
        markers.push(nearestBikeMarker)

        // Show the location-info div
        document.getElementById('location-info').style.display = 'block';

        

        
        // add a flag for he div if the user doesnt opt in for the cookie
        document.getElementById('nearest-station-info').innerHTML = 'Your nearest station is: <br>' + closestStationToUser.address;
     
        });


        // Center the map on the user's location
        map.setCenter(userPosition);
      }
  
// create makrer for users current location
  function createBlueMarker(position) {
    return new google.maps.Marker({
      position: position,
      map: map,
      icon: {
        url: '/static/man-walking-medium-skin-tone-svgrepo-com.svg',
        scaledSize: new google.maps.Size(50, 80),
        anchor: new google.maps.Point(12, 50),
         
      },
    });
  }

// Get toggle buttons
const toggleButtons = document.querySelectorAll(".toggle-button");

// Add event listeners to toggle buttons
  toggleButtons.forEach(function(button) {
  button.addEventListener("click", function() {
    // Toggle button state
    this.classList.toggle("active");
    
    // Toggle display state
    displayAvailable = this.id === "available_bikes";
    updateMarkerImages();
    
    // Reset other buttons
    toggleButtons.forEach(function(otherButton) {
      if (otherButton !== button) {
        otherButton.classList.remove("active");
      }
    });
  });
});
  
// makes prediction chart
async function populateChart() {
  const day = document.getElementById('day').value;
  const station = document.getElementById('Station').value;
  const chart_station_id = document.getElementById('Station').value;
  const chartData = [];


  let station_name = '';

   for (var i = 0; i < markers.length; i++) {
      var marker = markers[i];
      if (marker.station_number == chart_station_id){
            station_name += marker.title
            break
        }}


  // Show the loading bar
  const loadingBar = document.getElementById("loading-bar");
  const loadingBarProgress = loadingBar.querySelector(".loading-bar-progress");
  loadingBar.style.display = "block";

  const totalHours = 24;
  for (let i = 0; i < totalHours; i++) {
    // Create a dictionary containing the input values
    const data = {
      day: day,
      hour: i,
      station: station
    };

    // Send the data to the Flask backend using a POST request
    // The data is sent as a JSON string in the request body
    const response = await fetch('/predict', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    // Parse the JSON data from the response
    const result = await response.json();
    testresult = Math.floor(result.prediction);
    chartData.push(testresult);

    // Calculate the loading progress percentage
    const progressPercentage = ((i + 1) / totalHours) * 100;

    // Update the loading bar progress
    loadingBarProgress.style.width = `${progressPercentage}%`;
  }

  const ctx = document.getElementById('myChart').getContext('2d');
  // const gradientBg = ctx.createLinearGradient(100,0,0,0)
  const gradientBg = ctx.createLinearGradient(0, 0, 0, 600);
  gradientBg.addColorStop(0, 'rgba(23, 50, 200)');
  gradientBg.addColorStop(0.6, 'rgba(23, 100, 216)');
  gradientBg.addColorStop(1, 'rgba(23, 116, 222)');
  // Destroy the previous chart instance if it exists
  if (chart) {
    chart.destroy();
  }

// Set the chart data to chartData
chart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: ['12AM', '1AM', '2AM', '3AM', '4AM', '5AM', '6AM', '7AM', '8AM', '9AM', '10AM', '11AM', '12PM', '1PM', '2PM', '3PM', '4PM', '5PM', '6PM', '7PM', '8PM', '9PM', '10PM', '11PM'],
    datasets: [{
      label: '',
      data: chartData, // Use chartData here
      tension: 0.5,
      fill: true,
      borderWidth: 1,
      borderColor: 'rgba(23, 116, 222, 1)',
      backgroundColor: 'rgba(23, 116, 222, 0.15)'
    }]
  },
  options: {
    scales: {
      y: {
        ticks: {
          color: "white",
        },
        beginAtZero: true
      },
      x: {
        ticks: {
          color: "white",
        },
      }
    },
    plugins:{
    title: {
      display: true,
      text: `Predicted bike availability at ${station_name}`,
      color: "white",
    }}
  }
});
  
  // Hide the loading bar
  document.getElementById("loading-bar").style.display = "none";
}

//chart that plots Average Availability over 7 Days at x time 
//the first time this function is called i can't  access stationHistory
async function populateChartDay(stationHistory) {
  chart2loaded = true;
  const today = new Date();
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeek = daysOfWeek[today.getDay()];
  const station = stationHistory;
  var availabilityAvg = 0; 
  var availabilityCount = 0;
  var data =[];
  const name = stationHistory[0][0][0].name;

// iterate through every day of the week
for (const day of daysOfWeek) {
  var availabilityAvg = 0; 
  var availabilityCount = 0;

  // iterate through every object in the station array
  for (const obj of station[0][0]) {
    if (obj.dayofweek === day) {
      availabilityAvg += obj.availability;
      availabilityCount ++;
    }
  }

  const averageAvailability = availabilityAvg / availabilityCount;
  data.push({ dayOfWeek: day, averageAvailability: averageAvailability });
}

const labels = data.map(d => d.dayOfWeek);
const values = data.map(d => d.averageAvailability);
const ctx = document.getElementById('myChart2').getContext('2d');
// const gradientBg = ctx.createLinearGradient(100,0,0,0)
const gradientBg = ctx.createLinearGradient(0, 0, 0, 600);
gradientBg.addColorStop(0, 'rgba(23, 50, 200)');
gradientBg.addColorStop(0.6, 'rgba(23, 100, 216)');
gradientBg.addColorStop(1, 'rgba(23, 116, 222)');
// Destroy the previous chart instance if it exists
if (chart2) {
  chart2.data.labels = labels;
  chart2.data.datasets[0].data = values;
  chart2.options.plugins.title.text = `Weekly Available Bike Data at ${name}`;
  chart2.update();
}

// Set the chart data to chartData
chart2 = new Chart(ctx, {
type: 'bar',
data: {
  labels: labels,
  datasets: [{
    label: '',
    data: values,
    tension: 0.5,
    fill: true,
    borderWidth: 1,
    borderColor: 'rgba(23, 116, 222, 1)',
    backgroundColor: 'rgba(23, 116, 222, 0.15)'
  }]
},
options: {
  responsive: false ,
  maintainAspectRatio: true,
  // devicePixelRatio: 10,
  scales: {
    y: {
      ticks: {
        color: "white",
      },
      beginAtZero: true
    },
    x: {
      ticks: {
        color: "white",
      },
    }
  },
  plugins:{
  title: {
    display: true,
    text: `Weekly Available Bike Data for  ${name}`,
    color: "white",
  }}
}
});
checkCharts()
}

//chart that plots Average Availability over 7 Days at x time 
//the first time this function is called i can't  access stationHistory
async function populateChartHour(stationHistory) {
  chart3loaded = true;
  const today = new Date();
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const day = daysOfWeek[today.getDay()];  const station = stationHistory;
  var availabilityAvg = 0; 
  var availabilityCount = 0;
  var data =[];
  const name = stationHistory[0][1][0].name;
  
  
  // iterate through every object in the station array
  for (let i = 0; i < 24; i++) {
    var availabilityAvg = 0; 
    var availabilityCount = 0;
  
    // iterate through every object in the stationHistory array
    for (const obj of stationHistory[0][1]) {
      if (obj.dayofweek === day && parseInt(obj.hour) === i) {
        availabilityAvg += obj.availability;
        availabilityCount ++;
      }
    }
  
    const averageAvailability = availabilityAvg / availabilityCount;
    data.push({ hour: i, averageAvailability: averageAvailability });
  }
  


const labels = data.map(d => d.hour);
const values = data.map(d => d.averageAvailability);
const ctx = document.getElementById('myChart3').getContext('2d');
// const gradientBg = ctx.createLinearGradient(100,0,0,0)
const gradientBg = ctx.createLinearGradient(0, 0, 0, 600);
gradientBg.addColorStop(0, 'rgba(23, 50, 200)');
gradientBg.addColorStop(0.6, 'rgba(23, 100, 216)');
gradientBg.addColorStop(1, 'rgba(23, 116, 222)');
// Destroy the previous chart instance if it exists
// Update the chart data if it exists
if (chart3) {
  chart3.data.labels = labels;
  chart3.data.datasets[0].data = values;
  chart3.options.plugins.title.text = `Hourly Available Bike Data at ${name}`;
  chart3.update();
}

// Set the chart data to chartData
chart3 = new Chart(ctx, {
type: 'line',
data: {
  labels: labels,
  datasets: [{
    label: '',
    data: values, // Use chartData here
    fill: true,
    borderWidth: 1,
    borderColor: 'rgba(23, 116, 222, 1)',
    backgroundColor: 'rgba(23, 116, 222, 0.15)'
  }]
},
options: {
  responsive: false,
  maintainAspectRatio: true,
  scales: {
    y: {
      ticks: {
        color: "white",
        size: 12,
      },
      beginAtZero: true
    },
    x: {
      ticks: {
        color: "white",
        size: 12,

      },
    }
  },
  plugins:{
  title: {
    display: true,
    text: `Hourly Available Bike Data at ${name}`,
    color: "white", 
    size: 100,

  }}
}
});
checkCharts()
}

function checkCharts(){
  var chartContainer = document.getElementById("chart-container");
  if (chart2loaded && chart3loaded) {
    chartContainer.style.height = "240px";
  } else {
    chartContainer.style.height = "0px";
  }
}

var map = null; 

window.onload = initMap();