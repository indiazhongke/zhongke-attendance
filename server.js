const express = require("express")
const cors = require("cors")

const mongoose = require("mongoose")
mongoose.connect("mongodb+srv://Attendancedatabaseuser:%401234ZhongkeUser@attendance-crm.ulgrgmj.mongodb.net/attendance-crm?retryWrites=true&w=majority")

.then(()=> console.log("MongoDB Atlas Connected"))

.catch(err => console.log(err))

const app = express()

app.use(cors())
app.use(express.json())

let attendance = []

/* OFFICE LOCATION */

const officeLat = 28.53229417891668
const officeLng = 77.39766413771919
const allowedRadius = 100 // meters

const AttendanceSchema = new mongoose.Schema({

employee: String,
date: String,
login: String,
logout: String,
hours: String,
lat: Number,
lng: Number

})

const Attendance = mongoose.model("Attendance", AttendanceSchema)

const EmployeeSchema = new mongoose.Schema({
name: String,
active: {type:Boolean, default:true}
})

const Employee = mongoose.model("Employee", EmployeeSchema)

app.get("/employees", async(req,res)=>{
let data = await Employee.find()
res.json(data)
})

app.post("/employees", async(req,res)=>{

let {name} = req.body

let emp = new Employee({name})

await emp.save()

res.json({message:"Employee added"})

})

app.delete("/employees/:id", async(req,res)=>{

await Employee.findByIdAndDelete(req.params.id)

res.json({message:"Employee deleted"})

})

/* =========================
DISTANCE FUNCTION
========================= */

function getDistance(lat1, lon1, lat2, lon2){

let R = 6371e3

let φ1 = lat1 * Math.PI/180
let φ2 = lat2 * Math.PI/180

let Δφ = (lat2-lat1) * Math.PI/180
let Δλ = (lon2-lon1) * Math.PI/180

let a =
Math.sin(Δφ/2) * Math.sin(Δφ/2) +
Math.cos(φ1) * Math.cos(φ2) *
Math.sin(Δλ/2) * Math.sin(Δλ/2)

let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

let d = R * c

return d
}


/* =========================
CHECK IN
========================= */

app.post("/checkin", async (req,res)=>{

let {employee,lat,lng} = req.body
employee = employee.trim()

// Check if employee exists in the system
let emp = await Employee.findOne({name: employee})

if(!emp){
return res.json({message:"Employee not registered"})
}

let distance = getDistance(lat,lng,officeLat,officeLng)

if(distance > allowedRadius){

return res.json({
message:"You are not in office. Cannot check in."
})

}

let now = new Date()
let today = now.toISOString().split("T")[0]

let existing = await Attendance.findOne({
employee: employee,
date: today
})

if(existing){
return res.json({message:"Already checked in today"})
}

let record = new Attendance({

employee: employee,
date: today,
login: now.toTimeString().split(" ")[0],
logout:"",
hours:"",
lat: lat,
lng: lng

})

await record.save()

res.json({message:"Check in recorded"})

})


/* =========================
CHECK OUT
========================= */
app.post("/checkout", async (req,res)=>{

let {employee,lat,lng} = req.body
employee = employee.trim()

// Check if employee exists in the system
let emp = await Employee.findOne({name: employee})

if(!emp){
return res.json({message:"Employee not registered"})
}

let distance = getDistance(lat,lng,officeLat,officeLng)

if(distance > allowedRadius){

return res.json({
message:"You are not in office. Cannot check out."
})

}

let now = new Date()
let today = now.toISOString().split("T")[0]

let last = await Attendance.findOne({
employee: employee,
date: today,
logout: ""
}).sort({_id:-1})

if(!last){
return res.json({message:"No active login"})
}

last.logout = now.toTimeString().split(" ")[0]

let loginTime = new Date(`${last.date}T${last.login}`)
let logoutTime = new Date(`${last.date}T${last.logout}`)

let diff = (logoutTime - loginTime) / 1000 / 60 / 60

last.hours = diff.toFixed(2)

await last.save()

res.json({message:"Checkout done"})

})

/* =========================
GET ATTENDANCE
========================= */

app.get("/attendance", async (req,res)=>{

let data = await Attendance.find()

res.json(data)

})

/* =========================
DASHBOARD SUMMARY
========================= */

app.get("/dashboard", async (req,res)=>{

try{

let today = new Date().toISOString().split("T")[0]

let todaysAttendance = await Attendance.find({ date: today })

let present = todaysAttendance.length

let checkedOut = todaysAttendance.filter(a => a.logout).length

// Get total employees from Employee collection (not from attendance records)
let totalEmployees = await Employee.countDocuments({active: true})

let absent = totalEmployees - present

res.json({
totalEmployees,
present,
checkedOut,
absent
})

}catch(err){

console.log(err)
res.status(500).json({error:"Dashboard error"})

}

})

/* =========================
START SERVER
========================= */

app.listen(3000,()=>{
console.log("Server running on port 3000")
})