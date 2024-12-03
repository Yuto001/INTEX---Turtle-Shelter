const express = require("express");
const path = require("path");
const knex = require("knex")({
    client: "pg",
    connection: {
        host: process.env.RDS_HOSTNAME || "localhost",
        user: process.env.RDS_USERNAME || "postgres",
        password: process.env.RDS_PASSWORD || "password",
        database: process.env.RDS_DB_NAME || "turtleshelter", // Updated database name for the intex
        port: process.env.RDS_PORT || 5432,
        ssl: process.env.DB_SSL ? { rejectUnauthorized: false } : false,
    },
});

const app = express();
const port = process.env.PORT || 3000;

// Set up view engine and static file serving
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "css")));
app.use(express.static(path.join(__dirname, "public")));
app.use("/images", express.static(path.join(__dirname, "images")));
app.use(express.urlencoded({ extended: true }));

// Routes
app.get("/", (req, res) => {
    res.render("index");
});
//this is for login page
app.get("/login", (req, res) => {
    res.render("login");
});
// for admin landing page
app.get("/adminLanding", (req, res) => {
    res.render("adminLanding");
});
// for event list
app.get("/events", (req, res) => {
    res.render("events");
});

// for admin dashboard page
app.get("/adminDashboard", (req, res) => {
    res.render("adminDashboard");
});

// this is for login function
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    knex('loginuser') // Replace with your table name
        .select('username', 'password') // Include email in the query if necessary
        .where({ username }) // Check both username and email
        .first()
        .then(user => {
            if (user && user.password === password) {
                // User found and password matches
                
                res.redirect('/adminLanding'); // Redirect to /adminDahsboard
            } else {
                res.send('Invalid username or password');
            }
        })
        .catch(error => {
            console.error('Error during login:', error);
            res.status(500).send('Server error');
        });
});

// Route to test protected access (after login)
app.get('/protected', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).send("Unauthorized");
    }
    res.send("Welcome to the protected route!");
});

app.get("/maprating", async (req, res) => {
    try {
        const locations = await knex("location").select(
            "entryid",
            "city",
            "state",
            "danger_score",
            "food_score",
            "transportation_score",
            "ent_score",
            "accountid"
        );
        console.log("Query Result:", locations); // Debugging log
        res.render("maprating", { locations }); // Pass data as "locations"
    } catch (error) {
        console.error("Here is the error:", error);
        res.status(500).send("Server error");
    }
});

app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await knex("user")
            .select("*")
            .where({ username, password }) // Replace with hashed password in production
            .first();
        if (user) {
            console.log("Login successful:", user);
        } else {
            console.log("Invalid credentials");
        }
    } catch (error) {
        console.error("Database query failed:", error.message);
        res.status(500).send("Database query failed: " + error.message);
    }
    res.redirect("/");
});


// Set the view engine to EJS
app.set('view engine', 'ejs');

// Serve static files from the public folder
app.use(express.static('public'));

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/donate', (req, res) => {
    res.render('donate');
});

app.get('/news-detail', (req, res) => {
    res.render('news-detail');
});

app.get('/news', (req, res) => {
    res.render('news');
});



// GET Route to render the addEvent.ejs form
app.get('/addEvent', (req, res) => {
    res.render('addEvent');
});

app.post('/addEvent', async (req, res) => {
    const {
        city,
        address,
        event_Date,
        event_Start_Time,
        event_Duration,
        event_Description,
        organizer_Id,
        pockets,
        collars,
        envelopes,
        vests,
        completed_Products,
    } = req.body;

    try {
        await knex('event_info').insert({
            city,
            address,
            event_Date,
            event_Start_Time,
            event_Duration,
            event_Description,
            organizer_Id,
            pockets: pockets || 0, // Default to 0 if null
            collars: collars || 0,
            envelopes: envelopes || 0,
            vests: vests || 0,
            completed_Products: completed_Products || 0,
        });
        res.send('Event added successfully!');
    } catch (err) {
        console.error('Error inserting event:', err);
        res.status(500).send('Failed to add event.');
    }
});


// Serve editEvent form
app.get("/editEvent/:id?", async (req, res) => {
    const eventId = req.params.id;
    try {
        if (eventId) {
            // Fetch event data for editing
            const event = await knex("event_info").where({ event_id: eventId }).first();
            if (event) {
                res.render("editEvent", { event });
            } else {
                res.status(404).send("Event not found");
            }
        } else {
            // Render form for adding a new event
            res.render("editEvent", { event: null });
        }
    } catch (error) {
        console.error("Error fetching event data:", error);
        res.status(500).send("Server error");
    }
});

// Handle form submission for editing/creating an event
app.post("/editEvent", async (req, res) => {
    const {
        event_Id, // Included for updates
        city,
        address,
        event_Date,
        event_Start_Time,
        organizer_Id,
        event_Duration,
        event_Description,
        pockets,
        collars,
        envelopes,
        vests,
        completed_Products,
    } = req.body;

    try {
        if (event_Id) {
            // Update existing event
            await knex("event_info")
                .where({ event_id: event_Id })
                .update({
                    city,
                    address,
                    event_date: event_Date,
                    event_start_time: event_Start_Time,
                    organizer_id: organizer_Id,
                    event_duration: event_Duration,
                    event_description: event_Description,
                    pockets,
                    collars,
                    envelopes,
                    vests,
                    completed_products: completed_Products,
                });
            console.log("Event updated:", event_Id);
        } else {
            // Insert new event
            await knex("event_info").insert({
                city,
                address,
                event_date: event_Date,
                event_start_time: event_Start_Time,
                organizer_id: organizer_Id,
                event_duration: event_Duration,
                event_description: event_Description,
                pockets,
                collars,
                envelopes,
                vests,
                completed_products: completed_Products,
            });
            console.log("New event added");
        }

        res.redirect("/"); // Redirect to a confirmation or listing page
    } catch (error) {
        console.error("Error saving event data:", error);
        res.status(500).send("Server error");
    }
});

app.get('/viewVolun', (req, res) => {
    res.render('viewVolun');
});





// Start the server
app.listen(port, () =>
    console.log(`Express App has started and server is listening on port ${port}!`)
);
