const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

const INSPIRATIONS = [
    {
        id: 1,
        title: "Brandenburg Gate in the Rain",
        description: "Capture the reflections of the gate in the puddles on Pariser Platz.",
        location: "Pariser Platz, Berlin",
        lat: 52.5162,
        lng: 13.3777,
        mood: "Melancholic",
        season: "ALL",
        weatherCondition: "RAINY",
        timeOfDay: "EVENING",
        imageUrl: "https://images.unsplash.com/photo-1599424423953-27203673474e?auto=format&fit=crop&w=1000&q=80"
    },
    {
        id: 2,
        title: "Autumn Leaves in Tiergarten",
        description: "Use a shallow depth of field to capture the vibrant orange and red leaves.",
        location: "Tiergarten",
        lat: 52.5145,
        lng: 13.3501,
        mood: "Warm",
        season: "AUTUMN",
        weatherCondition: "SUNNY",
        timeOfDay: "AFTERNOON",
        imageUrl: "https://images.unsplash.com/photo-1542332213-9b5a5a3fad35?auto=format&fit=crop&w=1000&q=80"
    },
    {
        id: 3,
        title: "Cyberpunk Alexanderplatz",
        description: "Long exposure of the trams and neon signs at night.",
        location: "Alexanderplatz",
        lat: 52.5219,
        lng: 13.4132,
        mood: "Futuristic",
        season: "ALL",
        weatherCondition: "ANY",
        timeOfDay: "NIGHT",
        imageUrl: "https://images.unsplash.com/photo-1560930950-5cc20e80e392?auto=format&fit=crop&w=1000&q=80"
    },
    {
        id: 4,
        title: "Cherry Blossoms at TV Tower",
        description: "Frame the TV tower through the blooming cherry blossoms.",
        location: "Mauerpark or TV Tower area",
        lat: 52.5208,
        lng: 13.4094,
        mood: "Romantic",
        season: "SPRING",
        weatherCondition: "SUNNY",
        timeOfDay: "MORNING",
        imageUrl: "https://images.unsplash.com/photo-1559564614-a0fb01bba0f9?auto=format&fit=crop&w=1000&q=80"
    },
    {
        id: 5,
        title: "Snowy Victory Column",
        description: "The golden statue against a stark white snowy background.",
        location: "Siegessäule",
        lat: 52.5145,
        lng: 13.3501,
        mood: "Majestic",
        season: "WINTER",
        weatherCondition: "SNOWY",
        timeOfDay: "MORNING",
        imageUrl: "https://images.unsplash.com/photo-1485333287248-f62f33f6b490?auto=format&fit=crop&w=1000&q=80"
    },
    {
        id: 6,
        title: "Oberbaum Bridge Sunset",
        description: "Capture the U-Bahn crossing the bridge with the sunset in the background.",
        location: "Oberbaumbrücke",
        lat: 52.5019,
        lng: 13.4447,
        mood: "Atmospheric",
        season: "ALL",
        weatherCondition: "SUNNY",
        timeOfDay: "EVENING",
        imageUrl: "https://images.unsplash.com/photo-1541752171745-4196eead662a?auto=format&fit=crop&w=1000&q=80"
    },
    {
        id: 7,
        title: "East Side Gallery Details",
        description: "Focus on the textures and colors of the murals on the Berlin Wall.",
        location: "Mühlenstraße",
        lat: 52.5050,
        lng: 13.4397,
        mood: "Urban",
        season: "ALL",
        weatherCondition: "CLOUDY",
        timeOfDay: "AFTERNOON",
        imageUrl: "https://images.unsplash.com/photo-1520699049698-acd2fccb8cc8?auto=format&fit=crop&w=1000&q=80"
    },
    {
        id: 8,
        title: "Tempelhof Field Wide Angle",
        description: "The vast open space of the former airport is perfect for minimalist shots.",
        location: "Tempelhofer Feld",
        lat: 52.4730,
        lng: 13.4000,
        mood: "Minimalist",
        season: "ALL",
        weatherCondition: "ANY",
        timeOfDay: "AFTERNOON",
        imageUrl: "https://images.unsplash.com/photo-1563816173747-1510125027e6?auto=format&fit=crop&w=1000&q=80"
    },
    {
        id: 9,
        title: "Teufelsberg Radar Station",
        description: "Post-apocalyptic vibes with street art and panoramic views of the Grunewald.",
        location: "Teufelsberg",
        lat: 52.5016,
        lng: 13.2415,
        mood: "Edgy",
        season: "ALL",
        weatherCondition: "ANY",
        timeOfDay: "ANY",
        imageUrl: "https://images.unsplash.com/photo-1590425129648-5c4676579e7e?auto=format&fit=crop&w=1000&q=80"
    }
];

function getCurrentSeason() {
    const month = new Date().getMonth() + 1;
    if (month >= 3 && month <= 5) return "SPRING";
    if (month >= 6 && month <= 8) return "SUMMER";
    if (month >= 9 && month <= 11) return "AUTUMN";
    return "WINTER";
}

function getCurrentWeather() {
    const conditions = ["SUNNY", "RAINY", "CLOUDY", "SNOWY"];
    return conditions[Math.floor(Math.random() * conditions.length)];
}

const router = express.Router();

router.get('/weather', (req, res) => {
    res.json({
        weather: getCurrentWeather(),
        season: getCurrentSeason()
    });
});

router.get('/all-inspirations', (req, res) => {
    res.json(INSPIRATIONS);
});

router.get('/inspirations', (req, res) => {
    const season = getCurrentSeason();
    const weather = getCurrentWeather();
    
    let filtered = INSPIRATIONS.filter(insp => 
        (insp.season === "ALL" || insp.season === season) &&
        (insp.weatherCondition === "ANY" || insp.weatherCondition === weather)
    );
    
    if (filtered.length === 0) {
        // Return 2 random if none match
        filtered = [...INSPIRATIONS].sort(() => 0.5 - Math.random()).slice(0, 2);
    }
    
    res.json(filtered);
});

app.use('/api', router);

module.exports = app;
