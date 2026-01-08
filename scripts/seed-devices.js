const readline = require("readline");

// Group ID mappings from franchisee names
const groupMap = {
  "Jeffrey": "cmk4sv79g0000lh04lks7rpzl",      // Atcel Ventures Pte Ltd
  "Trevors": "cmk4uqwd8002pi904nacfj46d",      // YH Auto
  "Yvonne Ng": "cmk4uqxtb002si90478jzrbo3",    // Yvonne Ng
  "Silver Ang": "cmk4uqsys002ji904fiiqxx3l",   // My Happy Place (zihuisilver)
  "SJ Vendora": "cmk4uqzbp002wi9045l7x6xd8",   // SJ Vendora
  "Thomas Chan": null,                          // Not in system yet
  "Vendify": null,                              // Not in system yet
};

// Devices to add - UPDATE THIS LIST
const devices = [
  { deviceId: "852308", deviceName: "VY46", location: "164 Bukit Batok", group: "Jeffrey", price: 280 },
  { deviceId: "852309", deviceName: "PAC MAN 6", location: "PAC MAN 6", group: "Trevors", price: 450 },
  { deviceId: "852310", deviceName: "VY43", location: "Prime Yishun Ave 6", group: "Trevors", price: 280 },
  { deviceId: "852311", deviceName: "VY44", location: "Mandai Gallery", group: "Trevors", price: 350 },
  { deviceId: "852312", deviceName: "VY47", location: "440 Pasir Ris", group: "Jeffrey", price: 280 },
  { deviceId: "852313", deviceName: "VY41", location: "Shell Tiong Bahru", group: "SJ Vendora", price: 280 },
  { deviceId: "852314", deviceName: "VY48", location: "27 Bendemeer Rd", group: "Jeffrey", price: 280 },
  { deviceId: "852315", deviceName: "VY42", location: "Prime Joo Seng", group: "SJ Vendora", price: 280 },
  { deviceId: "852316", deviceName: "VY29", location: "Century Square", group: "SJ Vendora", price: 280 },
  { deviceId: "852317", deviceName: "VY39", location: "Shell Alexandra", group: "Yvonne Ng", price: 280 },
  { deviceId: "852341", deviceName: "VY54", location: "NTU 2", group: "Vendify", price: 240 },
  { deviceId: "852343", deviceName: "VY53", location: "NTU 1", group: "Vendify", price: 240 },
  { deviceId: "852344", deviceName: "VY52", location: "325 Balestier Rd", group: "Vendify", price: 280 },
  { deviceId: "852348", deviceName: "VY51", location: "Holiday Inn Bideford", group: "Vendify", price: 300 },
];

const API_URL = "https://sugarcane-backend-five.vercel.app/api/admin/devices";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase().trim());
    });
  });
}

async function createDevice(device) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        location: device.location,
        price: device.price,
        isActive: true,
        groupId: groupMap[device.group] || null,
      }),
    });

    const data = await response.json();

    if (data.success) {
      return { success: true };
    } else {
      return { success: false, error: data.error };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  if (devices.length === 0) {
    console.log("\n⚠️  No devices in the list. Add devices to the 'devices' array in the script.\n");
    rl.close();
    return;
  }

  console.log(`\n🚀 Ready to add ${devices.length} devices (requires confirmation for each)\n`);
  console.log("Commands: [y]es / [n]o / [s]kip / [a]ll (yes to all remaining) / [q]uit\n");

  const results = { added: [], skipped: [], failed: [] };
  let autoAccept = false;

  for (let i = 0; i < devices.length; i++) {
    const device = devices[i];
    const groupName = device.group + (groupMap[device.group] ? ` ✓` : ` ⚠️ (no group)`);
    const priceStr = `$${(device.price / 100).toFixed(2)}`;

    console.log(`\n[${i + 1}/${devices.length}] ─────────────────────────────`);
    console.log(`   Device ID: ${device.deviceId}`);
    console.log(`   Name:      ${device.deviceName}`);
    console.log(`   Location:  ${device.location}`);
    console.log(`   Price:     ${priceStr}`);
    console.log(`   Group:     ${groupName}`);

    let answer;
    if (autoAccept) {
      answer = "y";
      console.log(`   Auto-accepting...`);
    } else {
      answer = await ask(`\n   Add this device? [y/n/s/a/q]: `);
    }

    if (answer === "q" || answer === "quit") {
      console.log("\n🛑 Quitting...");
      break;
    }

    if (answer === "a" || answer === "all") {
      autoAccept = true;
      answer = "y";
    }

    if (answer === "y" || answer === "yes") {
      const result = await createDevice(device);
      if (result.success) {
        console.log(`   ✅ Added successfully!`);
        results.added.push(device);
      } else {
        console.log(`   ❌ Failed: ${result.error}`);
        results.failed.push({ ...device, error: result.error });
      }
    } else if (answer === "n" || answer === "no" || answer === "s" || answer === "skip") {
      console.log(`   ⏭️  Skipped`);
      results.skipped.push(device);
    } else {
      console.log(`   ⏭️  Unknown command, skipping...`);
      results.skipped.push(device);
    }
  }

  console.log(`\n${"═".repeat(50)}`);
  console.log(`📊 SUMMARY`);
  console.log(`${"═".repeat(50)}`);
  console.log(`   ✅ Added:   ${results.added.length}`);
  console.log(`   ⏭️  Skipped: ${results.skipped.length}`);
  console.log(`   ❌ Failed:  ${results.failed.length}`);

  if (results.failed.length > 0) {
    console.log(`\n❌ Failed devices:`);
    results.failed.forEach((d) => {
      console.log(`   - ${d.deviceId} ${d.deviceName}: ${d.error}`);
    });
  }

  rl.close();
}

main();
