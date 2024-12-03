const express = require("express");
const path = require("path");
const knex = require("knex")({
    client: "pg",
    connection: {
        host: process.env.RDS_HOSTNAME || "localhost",
        user: process.env.RDS_USERNAME || "postgres",
        password: process.env.RDS_PASSWORD || "",
        database: process.env.RDS_DB_NAME || "dbdb", // Updated database name for the intex
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

app.listen(port, () =>
    console.log(`Express App has started and server is listening on port ${port}!`)
);
