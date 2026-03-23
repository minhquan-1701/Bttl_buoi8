const mongoose = require('mongoose');
const User = require('./schemas/users'); // This is the user model
const Role = require('./schemas/roles'); // This is the role model
const { sendMail } = require('./utils/sendMailHandler');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Connect to MongoDB
const mongoURI = 'mongodb://localhost:27017/NNPTUD-C2';
mongoose.connect(mongoURI)
    .then(() => console.log("Connected to MongoDB..."))
    .catch(err => console.error("Could not connect to MongoDB:", err));

// Generate a random 16-character password
function generatePassword() {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
    let password = "";
    for (let i = 0; i < 16; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

async function importUsers(filePath) {
    try {
        // 1. Ensure the "user" role exists
        let userRole = await Role.findOne({ name: 'user' });
        if (!userRole) {
            console.log("Role 'user' not found, creating one...");
            userRole = new Role({ name: 'user', description: 'Standard user role' });
            await userRole.save();
        }

        const absolutePath = path.resolve(filePath);
        if (!fs.existsSync(absolutePath)) {
            console.error(`File ${filePath} not found.`);
            return;
        }

        const content = fs.readFileSync(absolutePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim() !== "");

        for (let line of lines) {
            const [username, email] = line.split(',').map(s => s.trim());
            if (!username || !email) {
                console.warn(`Skipping invalid line: ${line}`);
                continue;
            }

            const password = generatePassword();

            // Create user object
            const newUser = new User({
                username: username,
                email: email,
                password: password, // Note: userSchema hashes this in .pre('save')
                role: userRole._id,
                status: true
            });

            try {
                await newUser.save();
                console.log(`✓ User ${username} imported.`);

                // Send email with password
                const subject = "Your account information";
                const text = `Account created!\nUsername: ${username}\nEmail: ${email}\nPassword: ${password}\nRule: user`;
                const html = `
                    <h2>Welcome to the system!</h2>
                    <p>Your account has been created successfully.</p>
                    <ul>
                        <li><b>Username:</b> ${username}</li>
                        <li><b>Email:</b> ${email}</li>
                        <li><b>Password:</b> ${password}</li>
                        <li><b>Role:</b> user</li>
                    </ul>
                    <p>Please change your password after logging in for the first time.</p>
                `;

                await sendMail(email, subject, text, html);
                console.log(`✓ Email sent to ${email}`);

            } catch (err) {
                if (err.code === 11000) {
                    console.error(`✗ User ${username} or email already exists.`);
                } else {
                    console.error(`✗ Error importing user ${username}:`, err.message);
                }
            }
        }
    } catch (err) {
        console.error("Critical error during import:", err);
    } finally {
        mongoose.connection.close();
    }
}

// Check for input file in arguments
const inputFilePath = process.argv[2] || 'usersToImport.csv';
importUsers(inputFilePath);
