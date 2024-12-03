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

app.get("/login", (req, res) => {
    res.render("login");
});

app.get("/adminDashboard", (req, res) => {
    res.render("adminDashboard");
});

app.get('/events', (req, res) => {
    res.render('events');
});

app.get('/viewVolun', (req, res) => {
    res.render('viewVolun');
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


app.get("/dashboard_event_history", async (req, res) => {
    try {
        const events = await knex("event_info")
            .leftJoin("organizer_info", "event_info.organizer_Id", "organizer_info.organizer_ID")
            .select(
                "event_info.event_ID",
                "event_info.city",
                "event_info.address",
                "event_info.event_Date",
                "event_info.event_Start_Time",
                "event_info.event_Description",
                "event_info.pockets",
                "event_info.collars",
                "event_info.envelopes",
                "event_info.vests",
                "event_info.completed_Products",
                "event_info.organizer_Id",
                "organizer_info.organizer_Email" // Include organizer email
            );

        // Pass events to the view
        res.render("dashboard_event_history", { events });
    } catch (error) {
        console.error("Error fetching events:", error);
        res.status(500).send("Server error");
    }
});


// Route to delete an event
app.post("/deleteEvent/:id", async (req, res) => {
    const eventID = req.params.id;
    try {
        await knex("event_info").where({ event_ID: eventID }).del();
        console.log("Event deleted:", eventID);
        res.redirect("/dashboard_event_history");
    } catch (error) {
        console.error("Error deleting event:", error);
        res.status(500).send("Server error");
    }
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
        // Fetch the event details if editing
        let event = null;
        if (eventId) {
            event = await knex("event_info").where({ event_ID: eventId }).first();
        }

        // Fetch all organizers to populate the dropdown
        const organizers = await knex("organizer_info").select("organizer_ID", "organizer_Email");

        res.render("editEvent", { event, organizers });
    } catch (error) {
        console.error("Error fetching event or organizers:", error);
        res.status(500).send("Server error");
    }
});

// Handle form submission for editing/creating an event
app.post("/editEvent", async (req, res) => {
    const {
        event_ID, // Included for updates
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
        if (event_ID) {
            // Update existing event
            await knex("event_info")
                .where({ event_ID: event_ID })
                .update({
                    city,
                    address,
                    event_Date: event_Date,
                    event_Start_Time: event_Start_Time,
                    organizer_Id: organizer_Id,
                    event_Duration: event_Duration,
                    event_Description: event_Description,
                    pockets,
                    collars,
                    envelopes,
                    vests,
                    completed_Products: completed_Products,
                });
            console.log("Event updated:", event_ID);
        } 

        res.redirect("/dashboard_event_history"); // Redirect to a confirmation or listing page
    } catch (error) {
        console.error("Error saving event data:", error);
        res.status(500).send("Server error");
    }
});


app.get("/dashboard_organizers", async (req, res) => {
    try {
        // Fetch all organizers from the database
        const organizers = await knex("organizer_info").select(
            "organizer_ID",
            "organizer_First",
            "organizer_Last",
            "organizer_Email",
            "organizer_Phone"
        );

        // Render the dashboard with organizers data
        res.render("dashboard_organizers", { organizers });
    } catch (error) {
        console.error("Error fetching organizers:", error);
        res.status(500).send("Server error");
    }
});


app.get("/addOrganizer", (req, res) => {
    res.render("addOrganizer");
});

app.post("/addOrganizer", async (req, res) => {
    const { organizer_ID, organizer_Email, organizer_First, organizer_Last, organizer_Phone } = req.body;

    try {
        // Insert the new organizer into the database
        await knex("organizer_info").insert({
            organizer_Email,
            organizer_First,
            organizer_Last,
            organizer_Phone,
        });

        console.log("Organizer added:", {
            organizer_Email,
            organizer_First,
            organizer_Last,
            organizer_Phone,
        });

        res.redirect("/dashboard_organizers"); // Redirect to the dashboard or another page
    } catch (error) {
        console.error("Error adding organizer:", error);
        res.status(500).send("Server error");
    }
});


app.get("/editOrganizer/:id", async (req, res) => {
    const organizerId = req.params.id;

    try {
        // Fetch the organizer's details from the database
        const organizer = await knex("organizer_info")
            .where({ organizer_ID: organizerId })
            .first();

        if (!organizer) {
            return res.status(404).send("Organizer not found");
        }

        // Render the editOrganizer page with the organizer data
        res.render("editOrganizer", { organizer });
    } catch (error) {
        console.error("Error fetching organizer:", error);
        res.status(500).send("Server error");
    }
});

app.post("/editOrganizer", async (req, res) => {
    const { organizer_ID, organizer_First, organizer_Last, organizer_Email, organizer_Phone } = req.body;

    try {
        // Update the organizer in the database
        await knex("organizer_info")
            .where({ organizer_ID })
            .update({
                organizer_First,
                organizer_Last,
                organizer_Email,
                organizer_Phone,
            });

        console.log("Organizer updated:", {
            organizer_ID,
            organizer_First,
            organizer_Last,
            organizer_Email,
            organizer_Phone,
        });

        // Redirect back to the dashboard
        res.redirect("/dashboard_organizers");
    } catch (error) {
        console.error("Error updating organizer:", error);
        res.status(500).send("Server error");
    }
});

app.get("/addVolun", (req, res) => {
    res.render("addVolun");
});

app.post("/addVolun", async (req, res) => {
    const {

        volunteer_Email,
        volunteer_Fname,
        volunteer_Lname,
        volunteer_Phone,
        hours_Available,
        sewing_Skill,
        vir_Id
    } = req.body;

    try {
        // Insert the new volunteer into the database
        await knex("volunteer_info").insert({
            volunteer_Email,
            volunteer_Fname,
            volunteer_Lname,
            volunteer_Phone,
            hours_Available,
            sewing_Skill,
            vir_Id
        });

        console.log("Volunteer added:", {
            volunteer_Email,
            volunteer_Fname,
            volunteer_Lname,
            volunteer_Phone,
            hours_Available,
            sewing_Skill,
            vir_Id
        });

        res.redirect("/dashboard_volunteers"); // Redirect to the dashboard or another page
    } catch (error) {
        console.error("Error adding volunteer:", error);
        res.status(500).send("Server error");
    }
});

app.get("/dashboard_volunteers", async (req, res) => {
    try {
        // Fetch all volunteers from the database
        const volunteers = await knex("volunteer_info").select(
            "volunteer_ID",
            "volunteer_Email",
            "volunteer_Fname",
            "volunteer_Lname",
            "volunteer_Phone",
            "hours_Available",
            "sewing_Skill",
            "vir_Id"
        );

        // Render the dashboard view with volunteers data
        res.render("dashboard_volunteers", { volunteers });
    } catch (error) {
        console.error("Error fetching volunteers:", error);
        res.status(500).send("Server error");
    }
});

app.get("/viewVolun/:id", async (req, res) => {
    const volunteerId = req.params.id;
    try {
        const volunteer = await knex("volunteer_info").where({ volunteer_ID: volunteerId }).first();
        if (!volunteer) {
            return res.status(404).send("Volunteer not found");
        }
        res.render("viewVolun", { volunteer }); // You'll need to create the viewVolun.ejs page
    } catch (error) {
        console.error("Error fetching volunteer:", error);
        res.status(500).send("Server error");
    }
});


app.get("/editVolun/:id", async (req, res) => {
    const volunteerId = req.params.id;
    try {
        const volunteer = await knex("volunteer_info").where({ volunteer_ID: volunteerId }).first();
        if (!volunteer) {
            return res.status(404).send("Volunteer not found");
        }
        res.render("editVolun", { volunteer }); // Create the editVolun.ejs page for editing
    } catch (error) {
        console.error("Error fetching volunteer:", error);
        res.status(500).send("Server error");
    }
});


app.post("/deleteVolun/:id", async (req, res) => {
    const volunteerId = req.params.id;
    try {
        await knex("volunteer_info").where({ volunteer_ID: volunteerId }).del();
        console.log(`Volunteer with ID ${volunteerId} deleted`);
        res.redirect("/dashboard_volunteers");
    } catch (error) {
        console.error("Error deleting volunteer:", error);
        res.status(500).send("Server error");
    }
});

app.post("/editVolun", async (req, res) => {
    const {
        volunteer_ID,
        volunteer_Email,
        volunteer_Fname,
        volunteer_Lname,
        volunteer_Phone,
        hours_Available,
        sewing_Skill,
        vir_Id
    } = req.body;

    try {
        // Update the volunteer details in the database
        await knex("volunteer_info")
            .where({ volunteer_ID })
            .update({
                volunteer_Email,
                volunteer_Fname,
                volunteer_Lname,
                volunteer_Phone,
                hours_Available,
                sewing_Skill,
                vir_Id
            });

        console.log("Volunteer updated:", {
            volunteer_ID,
            volunteer_Email,
            volunteer_Fname,
            volunteer_Lname,
            volunteer_Phone,
            hours_Available,
            sewing_Skill,
            vir_Id
        });

        res.redirect("/dashboard_volunteers"); // Redirect to the dashboard or another page
    } catch (error) {
        console.error("Error updating volunteer:", error);
        res.status(500).send("Server error");
    }
});



// Start the server


app.listen(port, () =>
    
    console.log(`Express App has started and server is listening on port ${port}!`)
);
