var apiKey = "b44c25d4a3064de7ee1c3c21a9a0dd5e";

var weatherIcon = document.getElementById("weather-display-icon")
var weatherDescription = document.getElementById("weather-display-description")
var weatherTemp = document.getElementById("weather-display-temp")
var weatherCity = document.getElementById("weather-display-city")
var weatherHumidity = document.getElementById("weather-display-humidity")
var weatherPressure = document.getElementById("weather-display-pressure")
var weatherWind = document.getElementById("weather-display-wind")


var weatherInput = document.getElementById("weather-input-city");
var weatherSubmitButton = document.getElementById("weather-submit-button");
weatherSubmitButton.addEventListener("click", function() {
    var url = `https://api.openweathermap.org/data/2.5/weather?q=${weatherInput.value}&appid=${apiKey}`
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.send();
    xhr.onload = function() {
        let response = JSON.parse(xhr.response);
        console.log(response);
        weatherIcon.setAttribute("src",`http://openweathermap.org/img/wn/${response.weather[0].icon}@2x.png`);
        weatherDescription.innerHTML = response.weather[0].description;
        weatherTemp.innerHTML = `${response.main.temp} (K)`;
        weatherCity.innerHTML = `${response.name}`;
        weatherHumidity.innerHTML = `${response.main.humidity}`;
        weatherPressure.innerHTML = `${response.main.pressure}`
        weatherWind.innerHTML = `${response.wind.speed}`

        var desc = "";
        for(let i=0; i<response.weather.length; i++) {
            desc += response.weather[i].description;
        }

        rain.visible = false;

        if (desc.includes("clear")) {
            setSkybox("clear-sky");
        }
        else if (desc.includes("snow") || desc.includes("sleet")) {
            setSkybox("snowy-sky")
            rain.mode = 1;
            rain.visible = true
        }
        else if (desc.includes("rain") || desc.includes("drizzle")) {
            setSkybox("rainy-sky")
            rain.mode = 0;
            rain.visible = true
        }
        else {
            setSkybox("cloudy-sky");
        }
    }
})
