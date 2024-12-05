const express = require("express");
const bcrypt = require('bcrypt');
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
const session = require("express-session")
const port = process.env.PORT || 3000;

// Set up view engine and static file serving
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "css")));
// Serve static files from the public folder
app.use(express.static(path.join(__dirname, 'public')));
app.use("/images", express.static(path.join(__dirname, "images")));
app.use(express.urlencoded({ extended: true }));

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong!');
});

app.use(session({
    secret: "test", // Replace with a secure key
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Use `secure: true` if using HTTPS
})
);


// Routes
app.get("/", (req, res) => {
    res.render("index");
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.get("/adminLanding", isLoggedIn, (req, res) => {
    res.render("adminLanding");
});

app.get("/adminDashboard", isLoggedIn, (req, res) => {
    res.render("adminDashboard");
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
        res.render("events", { eventInfo }); // Pass data as "locations"
    } catch (error) {
        console.error("Here is the error:", error);
        res.status(500).send("Server error");
    }
});


// this is for login function

// for password hashing


app.get('/login', (req, res) => {
    // Render the login page without an error message
    res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const staff = await knex('staff_login').where({ username }).first();
        
        if (!staff || password !== staff.password) {
            // If credentials are invalid, render login.ejs with an error message
            return res.render('login', { error: 'Invalid username or password' });
        }

        // If login is successful, set session
        req.session.staffId = staff.id;
        console.log("Session ID after login:", req.session.staffId);
        res.redirect('/adminDashboard');

    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).send("Server error");
    }
});




function isLoggedIn(req, res, next) {
    console.log("Session data in isLoggedIn:", req.session);  // Log the session data
    if (!req.session.staffId) {
        return res.redirect('/login');  // Redirect to login if not authenticated
    }
    next();  // Proceed to the next handler if authenticated
}

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


app.get("/dashboard_event_history", isLoggedIn, async (req, res) => {
    try {
        const events = await knex("event_info")
            .leftJoin("organizer_info", "event_info.organizer_Id", "organizer_info.organizer_ID")
            .select(
                "event_info.event_ID",
                "event_info.city",
                "event_info.address",
                "event_info.event_Date",
                "event_info.event_Start_Time",
                "event_info.event_Duration",
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
app.post("/deleteEvent/:id", isLoggedIn, async (req, res) => {
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
app.get('/addEvent', isLoggedIn, (req, res) => {
    // Assuming you're using Knex to query the database
    knex('organizer_info')
        .select('organizer_ID', 'organizer_Email')
        .then(organizers => {
            res.render('addEvent', { organizers });
        })
        .catch(error => {
            console.error('Error fetching organizers:', error);
            res.status(500).send('Server Error');
        });
});


app.post('/addEvent', isLoggedIn, async (req, res) => {
    const {
        city,
        address,
        event_Date,
        event_Start_Time,
        event_Duration,
        event_Description,
        organizer_ID,
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
            organizer_Id: organizer_ID,
            pockets: pockets || 0, // Default to 0 if null
            collars: collars || 0,
            envelopes: envelopes || 0,
            vests: vests || 0,
            completed_Products: completed_Products || 0,
        });
        res.redirect("/dashboard_event_history");
    } catch (err) {
        console.error('Error inserting event:', err);
        res.status(500).send('Failed to add event.');
    }
});


// Serve editEvent form
app.get("/editEvent/:id?", isLoggedIn, async (req, res) => {
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
app.post("/editEvent", isLoggedIn, async (req, res) => {
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


app.get("/dashboard_organizers", isLoggedIn, async (req, res) => {
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


app.get("/addOrganizer", isLoggedIn, (req, res) => {
    res.render("addOrganizer");
});

app.post("/addOrganizer", isLoggedIn, async (req, res) => {
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

app.post("/deleteOrganizer/:id", isLoggedIn, async (req, res) => {
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



app.get("/editOrganizer/:id", isLoggedIn, async (req, res) => {
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

app.post("/editOrganizer", isLoggedIn, async (req, res) => {
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

app.get("/addVolun", async (req, res) => {
    try {
        // Fetch all resources from the database
        const volunteer_info_resource = await knex("volunteer_info_resource").select("*");

        // Pass resources to the EJS template
        res.render("addVolun", { volunteer_info_resource });
    } catch (error) {
        console.error("Error fetching resources for addVolun:", error);
        res.status(500).send("Server error");
    }
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

app.get("/dashboard_volunteers", isLoggedIn, async (req, res) => {
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

app.get("/viewVolun/:email", isLoggedIn, async (req, res) => {
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

app.post("/deleteVolunteerEvent/:email/:eventId", isLoggedIn, async (req, res) => {
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


app.get("/editVolun/:email", isLoggedIn, async (req, res) => {
    const volunteerEmail = req.params.email;

    try {
        const volunteer = await knex("volunteer_info").where({ volunteer_Email: volunteerEmail }).first();
        if (!volunteer) {
            return res.status(404).send("Volunteer not found");
        }

        const volunteer_info_resource = await knex("volunteer_info_resource").select("*");

        console.log("Volunteer:", volunteer); // Debug: log volunteer data
        console.log("Resources:", volunteer_info_resource); // Debug: log resource data

        res.render("editVolun", { volunteer, volunteer_info_resource });
    } catch (error) {
        console.error("Error fetching volunteer or resources:", error);
        res.status(500).send("Server error");
    }
});




app.post("/deleteVolun/:email", isLoggedIn, async (req, res) => {
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

app.post("/editVolun", isLoggedIn, async (req, res) => {
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


app.get("/addVolunteerEvent/:email", isLoggedIn, async (req, res) => {
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

app.post("/addVolunteerEvent/:email", isLoggedIn, async (req, res) => {
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
        res.redirect("/");
    } catch (error) {
        console.error("Error processing request:", error);
        res.status(500).send("Server error");
    }
});

app.get("/dashboard_requests", isLoggedIn, async (req, res) => {
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

app.post("/deleteEventRequest/:id", isLoggedIn, async (req, res) => {
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
app.get("/homelessnessInfo", (req, res) => {
    res.render("homelessnessInfo");
});

app.get("/dashboard_staff_login", isLoggedIn, async (req, res) => {
    try {
        // Fetch all records from the staff_login table
        const staff = await knex("staff_login").select("username", "password", "email");

        // Render the database_staff_accounts page with the fetched data
        res.render("dashboard_staff_login", { staff });
    } catch (error) {
        console.error("Error fetching staff data:", error);
        res.status(500).send("Server error");
    }
});

app.get("/addStaff", isLoggedIn,(req, res) => {
    res.render("addStaff");
});

app.post("/addStaff", isLoggedIn, async (req, res) => {
    const { username, password, email } = req.body;

    console.log("Received Data:", req.body);

    try {
        await knex("staff_login").insert({ username, password, email });
        res.redirect("/dashboard_staff_login");
    } catch (error) {
        console.error("Error adding staff:", error);
        res.status(500).send("Server error");
    }
});


app.get("/editStaff/:username", isLoggedIn, async (req, res) => {
    const { username } = req.params;  // Capture the username from the URL parameter

    try {
        // Fetch the staff member's record based on the username
        const staffMember = await knex("staff_login")
            .where({ username })
            .first();  // Get the first (and only) record

        if (!staffMember) {
            return res.status(404).send("Staff member not found");
        }

        // Render the edit form with the staff member's current username and password
        res.render("editStaff", { staffMember });
    } catch (error) {
        console.error("Error fetching staff member:", error);
        res.status(500).send("Server error");
    }
});

app.post("/editStaff/:username", isLoggedIn, async (req, res) => {
    const { username } = req.params;
    const { password, email } = req.body;

    try {
        // Prepare the update data
        const updateData = {};
        if (password) updateData.password = password.trim();
        if (email) updateData.email = email.trim();

        // Check if there's data to update
        if (Object.keys(updateData).length === 0) {
            return res.status(400).send("No data provided to update.");
        }

        // Perform the update
        await knex("staff_login")
            .where({ username })
            .update(updateData);

        res.redirect("/dashboard_staff_login");
    } catch (error) {
        console.error("Error editing staff:", error);
        res.status(500).send("Server error");
    }
});


app.post("/deleteStaff/:username", isLoggedIn, async (req, res) => {
    const { username } = req.params;

    try {
        // Delete the record with the given username
        await knex("staff_login")
            .where({ username })
            .del();

        // Redirect back to the staff accounts page after deleting
        res.redirect("/dashboard_staff_login");
    } catch (error) {
        console.error("Error deleting staff:", error);
        res.status(500).send("Failed to delete staff.");
    }
});


// Start the server


app.listen(port, () =>
    
    console.log(`Express App has started and server is listening on port ${port}!`)
);
