const express = require("express");
const path = require("path");
const knex = require("knex")({
    client: "pg",
    connection: {
        host: process.env.RDS_HOSTNAME || "localhost",
        user: process.env.RDS_USERNAME || "postgres",
        password: process.env.RDS_PASSWORD || "password", // this is the password for turtule shelter server
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
// Serve static files from the public folder
app.use(express.static(path.join(__dirname, 'public')));
app.use("/images", express.static(path.join(__dirname, "images")));
app.use(express.urlencoded({ extended: true }));

// Routes
app.get("/", (req, res) => {
    res.render("index");
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.get("/adminLanding", (req, res) => {
    res.render("adminLanding");
});

app.get("/adminDashboard", (req, res) => {
    res.render("adminDashboard");
});

app.get('/events', (req, res) => {
    res.render('events');
});


// this is for login function

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await knex('loginuser')
            .select('username', 'password')
            .where({ username })
            .first();

        if (user) {
            if (user.password === password) {
                return res.redirect('/adminDashboard'); // Successful login
            } else {
                return res.status(401).send('Invalid username or password'); // Password mismatch
            }
        } else {
            return res.status(404).send('User not found'); // Username not found
        }
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).send('Server error');
    }
});

// Route to test protected access (after login)
app.get('/protected', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).send("Unauthorized");
    }
    res.send("Welcome to the protected route!");
});




// Set the view engine to EJS
app.set('view engine', 'ejs');



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

app.get("/events", async (req, res) => {
    try {
        const eventInfo = await knex("event_info").select(
            "event_ID",
            "city",
            "address",
            "event_Start_Time",
            "event_Date",
            "organizer_Id",
            "event_Duration",
            "event_Description",
            "pockets",
            "collars",
            "envelopes",
            "vests",
            "completed_Products"
        );
        console.log("Query Result:", eventInfo); // Debugging log
        res.render("maprating", { eventInfo }); // Pass data as "locations"
    } catch (error) {
        console.error("Here is the error:", error);
        res.status(500).send("Server error");
    }
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

app.get("/viewOrganizer/:email", async (req, res) => {
    const organizerEmail = req.params.email;

    try {
        // Fetch the organizer's details
        const organizer = await knex("organizer_info")
            .where({ organizer_Email: organizerEmail })
            .first();

        if (!organizer) {
            return res.status(404).send("Organizer not found.");
        }

        // Fetch events associated with the organizer's email
        const events = await knex("event_info")
            .where({ organizer_Id: organizer.organizer_ID }) // Match organizer ID with events
            .select(
                "event_ID",
                "city",
                "address",
                "event_Date",
                "event_Start_Time",
                "event_Description",
                "event_Duration"
            );

        // Render the organizer's details and events page
        res.render("viewOrganizer", { organizer, events });
    } catch (error) {
        console.error("Error fetching organizer details or events:", error);
        res.status(500).send("Server error.");
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

app.post("/deleteOrganizer/:id", async (req, res) => {
    const { id } = req.params; // Capture the organizer ID from the route parameter

    try {
        // Delete the organizer with the given ID
        await knex("organizer_info").where("organizer_ID", id).del();

        console.log(`Organizer with ID ${id} deleted successfully.`);

        // Redirect back to the organizers dashboard after deletion
        res.redirect("/dashboard_organizers");
    } catch (error) {
        console.error("Error deleting organizer:", error);
        res.status(500).send("Failed to delete organizer.");
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
const volunteers = await knex('volunteer_info')
  .leftJoin('volunteer_info_resource', 'volunteer_info.vir_Id', 'volunteer_info_resource.vir_Id')
  .select('volunteer_info.volunteer_ID', 'volunteer_info.volunteer_Fname', 'volunteer_info.volunteer_Lname', 
          'volunteer_info.volunteer_Email', 'volunteer_info.volunteer_Phone', 'volunteer_info.hours_Available', 
          'volunteer_info.sewing_Skill', 'volunteer_info.vir_Id', 'volunteer_info_resource.type');

        // Render the dashboard view with volunteers data
        res.render("dashboard_volunteers", { volunteers });
    } catch (error) {
        console.error("Error fetching volunteers:", error);
        res.status(500).send("Server error");
    }
});

app.get("/viewVolun/:email", async (req, res) => {
    const volunteerEmail = req.params.email;

    try {
        // Fetch events associated with the volunteer's email from the three tables
        const events = await knex("event_individual_info")
            .join("event_info", "event_individual_info.event_id", "event_info.event_ID")
            .where({ "event_individual_info.volunteer_Email": volunteerEmail })
            .select(
                "event_info.event_ID",
                "event_info.city",
                "event_info.address",
                "event_info.event_Date",
                "event_info.event_Start_Time",
                "event_info.event_Description"
            );

        // Fetch the volunteer data (optional, if you want to display it)
        const volunteer = await knex("volunteer_info")
            .where({ volunteer_Email: volunteerEmail })
            .first();

        if (!volunteer) {
            return res.status(404).send("Volunteer not found");
        }

        // Render the viewVolun page with the events and volunteer data
        res.render("viewVolun", { events, volunteer });
    } catch (error) {
        console.error("Error fetching events for volunteer:", error);
        res.status(500).send("Server error");
    }
});

app.post("/deleteVolunteerEvent/:email/:eventId", async (req, res) => {
    const { email, eventId } = req.params; // Get the volunteer's email and event ID from the URL parameters

    try {
        // Delete the record linking the volunteer and the event
        await knex("event_individual_info")
            .where({
                volunteer_Email: email,
                event_id: eventId,
            })
            .del();

        console.log(`Event ${eventId} removed for volunteer ${email}.`);

        // Redirect back to the volunteer's event page
        res.redirect(`/viewVolun/${email}`);
    } catch (error) {
        console.error("Error deleting event for volunteer:", error);
        res.status(500).send("Failed to remove event.");
    }
});


app.get("/editVolun/:email", async (req, res) => {
    const volunteerEmail = req.params.email;
    try {
        const volunteer = await knex("volunteer_info").where({ volunteer_Email: volunteerEmail }).first();
        if (!volunteer) {
            return res.status(404).send("Volunteer not found");
        }
        res.render("editVolun", { volunteer }); // Create the editVolun.ejs page for editing
    } catch (error) {
        console.error("Error fetching volunteer:", error);
        res.status(500).send("Server error");
    }
});


app.post("/deleteVolun/:email", async (req, res) => {
    const volunteerEmail = req.params.email;
    try {
        await knex("volunteer_info").where({ volunteer_Email: volunteerEmail }).del();
        console.log(`Volunteer with email ${volunteerEmail} deleted`);
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


app.get("/addVolunteerEvent/:email", async (req, res) => {
    const volunteerEmail = req.params.email;

    try {
        // Fetch all events from the event_info table
        const events = await knex("event_info").select("event_ID", "event_Date", "event_Description");

        // Render the addVolunteerEvent page with the events
        res.render("addVolunteerEvent", { volunteerEmail, events });
    } catch (error) {
        console.error("Error fetching events:", error);
        res.status(500).send("Server error");
    }
});

app.post("/addVolunteerEvent/:email", async (req, res) => {
    const  volunteerEmail  = req.params.email;  // Capture volunteerEmail from URL
    const { event_ID } = req.body;  // Capture selected event_ID from the form

    console.log("Request Body:", req.body);  // Log the incoming request body
    console.log("Request Param:", req.params.email)
    try {
        // Check if event_ID is selected
        if (!event_ID) {
            return res.status(400).send("Please select at least one event.");
        }

        console.log("Selected Event ID:", event_ID);  // Log the selected event ID
        console.log("Selected Email:", volunteerEmail)

        // Insert the selected event into the event_individual_info table
        await knex("event_individual_info").insert({
            volunteer_Email: volunteerEmail,
            event_id: event_ID  // Ensure the correct column name (event_id)
        });

        console.log("Event added for volunteer:", volunteerEmail);

        // Redirect back to the volunteer's events page
        res.redirect(`/viewVolun/${volunteerEmail}`);
    } catch (error) {
        console.error("Error adding event for volunteer:", error);
        res.status(500).send("Server error");
    }
});

app.get("/requestForm", (req, res) => {
    res.render("requestForm");
});

app.post("/submitRequest", async (req, res) => {
    const {
        email,
        people_needed,
        sewing,
        date,
        city,
        street_address,
        start_time,
        length_of_time,
        story,
        organizer_first_name,
        organizer_last_name,
        organizer_phone
    } = req.body;

    try {
    // Check if the organizer email already exists in organizer_info
    const existingOrganizer = await knex("organizer_info")
        .select("organizer_Email") // Ensure column name matches the database schema
        .where({ organizer_Email: email }) // Correctly check for email
        .first();

    // Insert a new organizer record only if no existing organizer is found
    if (!existingOrganizer) {
        await knex("organizer_info").insert({
            organizer_Email: email, // Correct field names
            organizer_First: organizer_first_name,
            organizer_Last: organizer_last_name,
            organizer_Phone: organizer_phone
        });
        console.log("New organizer record created for:", email);
    } else {
        console.log("Organizer email already exists, skipping record creation:", email);
    }

        // Insert a new record into the event_requests table
        await knex("event_requests").insert({
            organizer_Email : email,
            num_People : people_needed,
            sewing : sewing,
            request_Date : date,
            request_City : city,
            request_Street_Address : street_address,
            request_Start_Time : start_time,
            request_Length: length_of_time,
            share_Story :  story
        });
        console.log("New event request record created for:", email);

        // Send a success response
        res.send("Request submitted successfully!");
    } catch (error) {
        console.error("Error processing request:", error);
        res.status(500).send("Server error");
    }
});

app.get("/dashboard_requests", async (req, res) => {
    try {
        // Fetch all records from the event_requests table
        const requests = await knex("event_requests").select(
            "request_Id",
            "organizer_Email",
            "num_People",
            "sewing",
            "request_Date",
            "request_City",
            "request_Street_Address",
            "request_Start_Time",
            "request_Length",
            "share_Story"
        );

        // Render the EJS page and pass the records
        res.render("dashboard_requests", { requests });
    } catch (error) {
        console.error("Error fetching event requests:", error);
        res.status(500).send("Failed to fetch event requests.");
    }
});

app.post("/deleteEventRequest/:id", async (req, res) => {
    const { id } = req.params; // Capture the request ID from the route parameter

    try {
        // Delete the record from the event_requests table
        await knex("event_requests").where("request_Id", id).del();

        console.log(`Request with ID ${id} deleted successfully.`);

        // Redirect back to the eventRequests page
        res.redirect("/dashboard_requests");
    } catch (error) {
        console.error("Error deleting request:", error);
        res.status(500).send("Failed to delete the request.");
    }
});



app.get("/jensStory", (req, res) => {
    res.render("jensStory");
});

app.get("/techInfo", (req, res) => {
    res.render("techInfo");
});



// Start the server


app.listen(port, () =>
    
    console.log(`Express App has started and server is listening on port ${port}!`)
);
