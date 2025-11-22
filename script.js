/* -----------------------------
   Firebase Setup
------------------------------ */
  const firebaseConfig = {
  apiKey: "AIzaSyCCRKbIKfPGZ6s6qP9i2JsQ_mCdk_iSIho",
  authDomain: "royal-holding.firebaseapp.com",
  projectId: "royal-holding",
  storageBucket: "royal-holding.firebasestorage.app",
  messagingSenderId: "917277297176",
  appId: "1:917277297176:web:ab8df1eca1d82cec42516d",
  measurementId: "G-VN06QQZDH6"
};

let db, auth, isFirebaseConfigured = false;

try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    isFirebaseConfigured = true;
} catch (error) {
    console.error("Firebase not configured:", error);
    showAlert("Firebase not configured.", "error");
}

/* -----------------------------
   Global State
------------------------------ */
let currentUser = null;
let businesses = [];
let returns = [];

const COLLECTIONS = {
    BUSINESSES: "businesses",
    RETURNS: "returns",
    ADMIN: "admin"
};

/* -----------------------------
   App Initialization
------------------------------ */
document.addEventListener("DOMContentLoaded", () => {
    initializeApp();
});

async function initializeApp() {
    hideAll();
    const notice = document.getElementById("setupNotice");
    notice.innerHTML = "<p style='text-align:center;color:#666;'>Loading...</p>";
    notice.style.display = "block";

    if (isFirebaseConfigured) {
        try {
            await loadData();
        } catch (err) {
            console.error("Init error:", err);
            showAlert("Error loading data.", "error");
        }
    }

    notice.style.display = "none";

    const savedUser = sessionStorage.getItem("currentUser");
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        if (currentUser.type === "admin") showAdminDashboard();
        else showBusinessDashboard();
    } else {
        showLogin();
    }
}

async function loadData() {
    const businessesSnapshot = await db.collection(COLLECTIONS.BUSINESSES).get();
    businesses = businessesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const returnsSnapshot = await db.collection(COLLECTIONS.RETURNS).get();
    returns = returnsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/* -----------------------------
   Authentication
------------------------------ */
function showLogin() {
    hideAll();
    document.getElementById("loginScreen").classList.remove("hidden");
}
function showRegister() {
    hideAll();
    document.getElementById("registerScreen").classList.remove("hidden");
}
function hideAll() {
    ["loginScreen", "registerScreen", "businessDashboard", "adminDashboard"]
        .forEach(id => document.getElementById(id).classList.add("hidden"));
}

async function handleLogin() {
    const userType = document.getElementById("userType").value;
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!email || !password) return showAlert("Enter email & password", "error");

    if (userType === "admin") {
        await handleAdminLogin(email, password);
    } else {
        await handleBusinessLogin(email, password);
    }
}

async function handleAdminLogin(email, password) {
    try {
        const snapshot = await db.collection(COLLECTIONS.ADMIN)
            .where("email", "==", email)
            .where("password", "==", password)
            .get();

        if (!snapshot.empty) {
            currentUser = { type: "admin", email };
            sessionStorage.setItem("currentUser", JSON.stringify(currentUser));
            showAdminDashboard();
            return showAlert("Admin login successful", "success");
        }

        showAlert("Invalid admin credentials", "error");
    } catch (err) {
        console.error("Admin login error:", err);
        showAlert("Login failed", "error");
    }
}

async function handleBusinessLogin(email, password) {
    const business = businesses.find(b => b.email === email && b.password === password);
    if (!business) return showAlert("Invalid business credentials", "error");
    if (business.status === "suspended") return showAlert("Account suspended", "error");

    currentUser = { type: "business", ...business };
    sessionStorage.setItem("currentUser", JSON.stringify(currentUser));
    showBusinessDashboard();
    showAlert(`Welcome back, ${business.businessName}`, "success");
}

async function handleRegister() {
    const businessName = document.getElementById("regBusinessName").value.trim();
    const contactName = document.getElementById("regContactName").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const phone = document.getElementById("regPhone").value.trim();
    const password = document.getElementById("regPassword").value;

    // ✅ Check required fields
    if (!businessName || !contactName || !email || !phone || !password) {
        return showAlert("Fill all fields", "error");
    }

    // ✅ Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return showAlert("Enter a valid email address", "error");
    }

    // ✅ Block disposable/temporary emails
    const disposableDomains = [
        "mailinator.com", "tempmail.com", "10minutemail.com",
        "guerrillamail.com", "yopmail.com", "trashmail.com"
    ];

    const emailDomain = email.split("@")[1].toLowerCase();
    if (disposableDomains.includes(emailDomain)) {
        return showAlert("Temporary email addresses are not allowed", "error");
    }


    // ✅ Validate phone number (10 digits only)
    if (!/^\d{10}$/.test(phone)) {
        return showAlert("Phone number must be exactly 10 digits", "error");
    }

    // ✅ Validate password length (> 8 characters)
    if (password.length < 8) {
        return showAlert("Password must be at least 8 characters", "error");
    }

    // ✅ Check for duplicate email
    if (businesses.find(b => b.email === email)) {
        return showAlert("Email already exists", "error");
    }

    // ✅ Create new business
    const newBusiness = {
        businessName,
        contactName,
        email,
        phone,
        password,
        status: "active",
        registeredDate: new Date().toISOString()
    };

    try {
        const docRef = await db.collection(COLLECTIONS.BUSINESSES).add(newBusiness);
        newBusiness.id = docRef.id;
        businesses.push(newBusiness);

        showAlert("Registration successful!", "success");
        showLogin();
    } catch (err) {
        console.error("Error registering business:", err);
        showAlert("Registration failed", "error");
    }
}


function logout() {
    currentUser = null;
    sessionStorage.removeItem("currentUser");
    showLogin();
    showAlert("Logged out", "success");
}

/* -----------------------------
   Business Dashboard
------------------------------ */
function showBusinessDashboard() {
    hideAll();
    document.getElementById("businessDashboard").classList.remove("hidden");
    document.getElementById("businessName").textContent = currentUser.businessName;
    showBusinessTab("search");
}

function showBusinessTab(tab) {
    document.getElementById("businessAddTab").classList.add("hidden");
    document.getElementById("businessSearchTab").classList.add("hidden");

    document.getElementById("tabSearch").classList.remove("active");
    document.getElementById("tabAdd").classList.remove("active");

    if (tab === "add") {
        document.getElementById("businessAddTab").classList.remove("hidden");
        document.getElementById("tabAdd").classList.add("active");
    } else {
        document.getElementById("businessSearchTab").classList.remove("hidden");
        document.getElementById("tabSearch").classList.add("active");
    }
}

// 

async function addReturn() {
    const customerName = document.getElementById("customerName").value.trim();
    const customerAddress = document.getElementById("customerAddress").value.trim();
    const phone1 = document.getElementById("phone1").value.trim();
    const phone2 = document.getElementById("phone2").value.trim();
    const whatsapp = document.getElementById("whatsapp").value.trim();

    // 👇 UPDATED: Read ONLY the single Status value
    const returnStatus = document.getElementById("returnStatus").value;
    // Removed: const returnOutcome = document.getElementById("returnOutcome").value;

    const returnDetails = document.getElementById("returnDetails").value.trim();
    const itemDetails = document.getElementById("itemDetails").value.trim();

    // UPDATED: Check for all required fields, only requiring returnStatus
    if (!customerName || !customerAddress || !phone1 || !returnStatus || !returnDetails || !itemDetails) {
        return showAlert("Please fill all required fields, including Status.", "error");
    }
    
    // KEEP: Phone number validation
    if (!/^\d{10}$/.test(phone1)) return showAlert("Phone Number 1 must be exactly 10 digits.", "error");
    if (phone2 && !/^\d{10}$/.test(phone2)) return showAlert("If provided, Phone Number 2 must be exactly 10 digits.", "error");
    if (whatsapp && !/^\d+$/.test(whatsapp)) return showAlert("If provided, WhatsApp Number must contain only digits.", "error");


    const newReturn = {
        businessId: currentUser.id,
        businessName: currentUser.businessName,
        customerName,
        customerAddress,
        phone1,
        phone2: phone2 || null,
        whatsapp: whatsapp || null,
        
        // 👇 UPDATED: Save only the single Status field
        returnStatus,
        // Removed: returnOutcome,
        
        returnDetails,
        itemDetails,
        dateAdded: new Date().toISOString()
    };

    try {
        const docRef = await db.collection(COLLECTIONS.RETURNS).add(newReturn);
        newReturn.id = docRef.id;
        returns.push(newReturn);

        // Reset form fields
        document.querySelectorAll("#businessAddTab input, #businessAddTab textarea")
            .forEach(el => el.value = "");
        // Reset dropdown
        document.getElementById("returnStatus").value = "";

        showAlert("Return record added successfully", "success");
    } catch (error) {
        console.error("Error adding return:", error);
        showAlert("Failed to add return. Try again.", "error");
    }
}


// function universalSearchRecords() {
//     const query = document.getElementById("universalSearch").value.trim().toLowerCase();
//     const container = document.getElementById("searchResults");

//     if (!query) {
//         container.innerHTML = "<p style='text-align:center;color:#666;font-style:italic;'>Start typing to search records</p>";
//         return;
//     }

//     // 🔥 Now includes all businesses, not just current user
//     let results = returns;

//     results = results.filter(r =>
//         (r.customerName && r.customerName.toLowerCase().includes(query)) ||
//         (r.customerAddress && r.customerAddress.toLowerCase().includes(query)) ||
//         (r.phone1 && r.phone1.includes(query)) ||
//         (r.phone2 && r.phone2.includes(query)) ||
//         (r.whatsapp && r.whatsapp.includes(query)) ||
//         (r.returnDetails && r.returnDetails.toLowerCase().includes(query)) ||
//         (r.itemDetails && r.itemDetails.toLowerCase().includes(query)) ||
//         (r.businessName && r.businessName.toLowerCase().includes(query)) // 🔥 can also search by business
//     );

//     if (!results.length) {
//         container.innerHTML = "<p style='text-align:center;color:#999;'>No records found</p>";
//     } else {
//         container.innerHTML = results.map(r => `
//             <div class="result-card" style="border-bottom:1px solid #eee;padding:10px 0;text-align:left;">
//                 <p><b>Customer Name:</b> ${r.customerName}</p>
//                 <p><b>Business Name:</b> ${r.businessName}</p>
//                 <p><b>Address:</b> ${r.customerAddress}</p>
//                 <p><b>Phone 1:</b> ${r.phone1}</p>
//                 <p><b>Phone 2:</b> ${r.phone2}</p>
//                 <p><b>WhatsApp:</b> ${r.whatsapp || "-"}</p>
//                 <p><b>Return Details:</b> ${r.returnDetails}</p>
//                 <p><b>Item Details:</b> ${r.itemDetails}</p>
//                 <p><b>Added on:</b> ${new Date(r.dateAdded).toLocaleString()}</p>
//             </div>
//         `).join("");
//     }
// }

function universalSearchRecords() {
    const query = document.getElementById("universalSearch").value.trim().toLowerCase();
    const container = document.getElementById("searchResults");

    if (!query) {
        container.innerHTML = "<p style='text-align:center;color:#666;font-style:italic;'>Start typing to search records</p>";
        return;
    }

    // Includes all businesses
    let results = returns;

    results = results.filter(r =>
        (r.customerName && r.customerName.toLowerCase().includes(query)) ||
        (r.customerAddress && r.customerAddress.toLowerCase().includes(query)) ||
        (r.phone1 && r.phone1.includes(query)) ||
        (r.phone2 && r.phone2.includes(query)) ||
        (r.whatsapp && r.whatsapp.includes(query)) ||
        // 👇 EDITED: Robust search filter for Status Remark (new key) or Return Details (old key)
        ((r.statusRemark || r.returnDetails) && (r.statusRemark || r.returnDetails).toLowerCase().includes(query)) ||
        (r.itemDetails && r.itemDetails.toLowerCase().includes(query)) ||
        (r.businessName && r.businessName.toLowerCase().includes(query))
    );

    if (!results.length) {
        container.innerHTML = "<p style='text-align:center;color:#999;'>No records found</p>";
    } else {
        container.innerHTML = results.map(r => `
            <div class="result-card" style="border-bottom:1px solid #eee;padding:10px 0;text-align:left;">
                <p><b>Customer Name:</b> ${r.customerName}</p>
                <p><b>Business Name:</b> ${r.businessName}</p>
                <p><b>Address:</b> ${r.customerAddress}</p>
                <p><b>Phone 1:</b> ${r.phone1}</p>
                <p><b>Phone 2:</b> ${r.phone2 || "-"}</p>
                <p><b>WhatsApp:</b> ${r.whatsapp || "-"}</p>
                
                <p><b>Status:</b> <span style="font-weight:700; color:${r.returnStatus === 'Cancelled' ? '#c00080ff' : '#dd0404ff'};">${r.returnStatus}</span></p>

                <p><b>Status Remark:</b> ${r.statusRemark || r.returnDetails}</p>
                
                <p><b>Item Details:</b> ${r.itemDetails}</p>
                <p><b>Added on:</b> ${new Date(r.dateAdded).toLocaleString()}</p>
            </div>
        `).join("");
    }
}


/* -----------------------------
   Admin Dashboard
------------------------------ */
function showAdminDashboard() {
    hideAll();
    document.getElementById("adminDashboard").classList.remove("hidden");
    updateAdminStats();
    showAdminTab("businesses");
}

function updateAdminStats() {
    document.getElementById("totalBusinesses").textContent = businesses.length;
    document.getElementById("totalReturns").textContent = returns.length;
    document.getElementById("activeBusinesses").textContent = businesses.filter(b => b.status === "active").length;
}

function showAdminTab(tab) {
    document.getElementById("adminBusinessesTab").classList.add("hidden");
    document.getElementById("adminReturnsTab").classList.add("hidden");

    const tabs = document.querySelectorAll("#adminDashboard .tabs .tab");
    tabs.forEach(t => t.classList.remove("active"));

    if (tab === "businesses") {
        document.getElementById("adminBusinessesTab").classList.remove("hidden");
        tabs[0].classList.add("active");
        loadBusinessesList();
    } else {
        document.getElementById("adminReturnsTab").classList.remove("hidden");
        tabs[1].classList.add("active");
        loadReturnsList();
    }
}

/* -----------------------------
   Admin: Manage Businesses
------------------------------ */
async function loadBusinessesList() {
    const container = document.getElementById("businessesList");
    container.innerHTML = "<p style='text-align:center;color:#666;'>Loading businesses...</p>";

    try {
        const snapshot = await db.collection(COLLECTIONS.BUSINESSES).get();
        businesses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (!businesses.length) {
            container.innerHTML = "<p style='text-align:center;color:#999;'>No businesses found</p>";
            return;
        }

        container.innerHTML = businesses.map(b => `
            <div class="result-card" style="border-bottom:1px solid #eee;padding:12px 0;display:flex;justify-content:space-between;align-items:flex-start;text-align:left;">
                <div style="flex:1;">
                    <p><b>Business Name:</b> ${b.businessName}</p>
                    <p><b>Contact Person:</b> ${b.contactName}</p>
                    <p><b>Email:</b> ${b.email}</p>
                    <p><b>Phone:</b> ${b.phone}</p>
                    <p><b>Status:</b> ${b.status}</p>
                </div>
                <button class="btn btn-small btn-danger" onclick="deleteBusiness('${b.id}')">Delete</button>
            </div>
        `).join("");
    } catch (err) {
        console.error("Error loading businesses:", err);
        container.innerHTML = "<p style='color:red;'>Failed to load businesses.</p>";
    }
}

async function deleteBusiness(id) {
    if (!confirm("Are you sure you want to delete this business?")) return;
    try {
        await db.collection(COLLECTIONS.BUSINESSES).doc(id).delete();
        businesses = businesses.filter(b => b.id !== id);
        showAlert("Business deleted successfully", "success");
        updateAdminStats();
        loadBusinessesList();
    } catch (err) {
        console.error("Error deleting business:", err);
        showAlert("Failed to delete business", "error");
    }
}

/* -----------------------------
   Admin: All Returns
------------------------------ */
// async function loadReturnsList() {
//     const container = document.getElementById("allReturnsList");
//     container.innerHTML = "<p style='text-align:center;color:#666;'>Loading returns...</p>";

//     try {
//         const snapshot = await db.collection(COLLECTIONS.RETURNS).get();
//         returns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

//         if (!returns.length) {
//             container.innerHTML = "<p style='text-align:center;color:#999;'>No returns found</p>";
//             return;
//         }

//         container.innerHTML = returns.map(r => `
//             <div class="result-card" style="border-bottom:1px solid #eee;padding:12px 0;display:flex;justify-content:space-between;align-items:flex-start;text-align:left;">
//                 <div style="flex:1;">
//                     <p><b>Customer Name:</b> ${r.customerName}</p>
//                     <p><b>Business Name:</b> ${r.businessName}</p>
//                     <p><b>Address:</b> ${r.customerAddress}</p>
//                     <p><b>Phone 1:</b> ${r.phone1} | <b>Phone 2:</b> ${r.phone2} | <b>WhatsApp:</b> ${r.whatsapp || "-"}</p>
//                     <p><b>Return Details:</b> ${r.returnDetails}</p>
//                     <p><b>Item Details:</b> ${r.itemDetails}</p>
//                     <p><b>Added on:</b> ${new Date(r.dateAdded).toLocaleString()}</p>
//                 </div>
//                 <button class="btn btn-small btn-danger" onclick="deleteReturn('${r.id}')">Delete</button>
//             </div>
//         `).join("");
//     } catch (err) {
//         console.error("Error loading returns:", err);
//         container.innerHTML = "<p style='color:red;'>Failed to load returns.</p>";
//     }
// }

async function loadReturnsList() {
    const container = document.getElementById("allReturnsList");
    container.innerHTML = "<p style='text-align:center;color:#666;'>Loading returns...</p>";

    try {
        const snapshot = await db.collection(COLLECTIONS.RETURNS).get();
        returns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (!returns.length) {
            container.innerHTML = "<p style='text-align:center;color:#999;'>No returns found</p>";
            return;
        }

        container.innerHTML = returns.map(r => `
            <div class="result-card" style="border-bottom:1px solid #eee;padding:12px 0;display:flex;justify-content:space-between;align-items:flex-start;text-align:left;">
                <div style="flex:1;">
                    <p><b>Customer Name:</b> ${r.customerName}</p>
                    <p><b>Business Name:</b> ${r.businessName}</p>
                    <p><b>Address:</b> ${r.customerAddress}</p>
                    <p><b>Phone 1:</b> ${r.phone1} | <b>Phone 2:</b> ${r.phone2 || "-"} | <b>WhatsApp:</b> ${r.whatsapp || "-"}</p>
                    
                    <p><b>Status:</b> <span style="font-weight:700; color:${r.returnStatus === 'Cancelled' ? '#dc3545' : '#28a745'};">${r.returnStatus}</span></p>

                    <p><b>Status Remark:</b> ${r.statusRemark || r.returnDetails}</p>

                    <p><b>Item Details:</b> ${r.itemDetails}</p>
                    <p><b>Added on:</b> ${new Date(r.dateAdded).toLocaleString()}</p>
                </div>
                <button class="btn btn-small btn-danger" onclick="deleteReturn('${r.id}')">Delete</button>
            </div>
        `).join("");
    } catch (err) {
        console.error("Error loading returns:", err);
        container.innerHTML = "<p style='color:red;'>Failed to load returns.</p>";
    }
}

async function deleteReturn(id) {
    if (!confirm("Are you sure you want to delete this return record?")) return;
    try {
        await db.collection(COLLECTIONS.RETURNS).doc(id).delete();
        returns = returns.filter(r => r.id !== id);
        showAlert("Return deleted successfully", "success");
        updateAdminStats();
        loadReturnsList();
    } catch (err) {
        console.error("Error deleting return:", err);
        showAlert("Failed to delete return", "error");
    }
}

/* -----------------------------
   Utility
------------------------------ */
function showAlert(msg, type) {
    const el = document.createElement("div");
    el.className = `alert alert-${type}`;
    el.textContent = msg;
    document.getElementById("alertContainer").appendChild(el);
    setTimeout(() => el.remove(), 4000);
}
