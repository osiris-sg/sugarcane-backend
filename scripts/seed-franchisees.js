const franchisees = [
  // { name: "Atcel Ventures Pte Ltd", email: "Jeffrey2511@yahoo.com.sg" }, // Already created
  { name: "My Happy Place", email: "zihuisilver@gmail.com" },
  { name: "LVM", email: "vyleroy@gmail.com" },
  { name: "YH Auto", email: "trevorshee@gmail.com" },
  // { name: "Arca Advisory Pte Ltd", email: "" }, // No email
  { name: "Yvonne Ng", email: "vonster07@gmail.com" },
  { name: "SJ Vendora", email: "Sjvendora@gmail.com" },
  { name: "Jaslyn Kee", email: "k.jaslyn68@gmail.com" },
  { name: "Marleen Lim", email: "midgal@gmail.com" },
  { name: "Shalom Wong Wei Hao", email: "shalomwong516@yahoo.com.sg" },
  { name: "See Pei Ling", email: "spl.831@gmail.com" },
  { name: "Kua Aik Hong", email: "keyihuang@gmail.com" },
  { name: "Munesh Mickey", email: "muneshmck9@gmail.com" },
  { name: "Perficient Vending", email: "trucaresg@gmail.com" },
  { name: "Hee Cheng Ting", email: "heeman1979@yahoo.com" },
  { name: "Chris Lam", email: "misc2746@gmail.com" },
  { name: "Hao Tian", email: "haotianyu94@gmail.com" },
  { name: "Elaine Lim Tze Ting", email: "elainepaperstop@gmail.com" },
  { name: "Lye Wai Ping", email: "Chyeming.ng@gmail.com" },
  { name: "Atherus & Aureon Pte Ltd", email: "adamyeeks@gmail.com" },
  { name: "Ng Shi Yong", email: "nsy_31@yahoo.com.sg" },
  { name: "Kavitha Saravana Perumal", email: "kavi.vsp@gmail.com" },
  { name: "Eileen Khong Lai Kie", email: "eileenkhong@gmail.com" },
  { name: "Han Xuyang", email: "han_xu_yang@hotmail.com" },
  { name: "Li Zhenyang", email: "zyli84@gmail.com" },
  { name: "FILZAH NADIAH BTE FA.", email: "nadiahfilz@hotmail.com" },
  { name: "Hoha Pte Ltd", email: "angpeikiat@gmail.com" },
  { name: "Dream Knit", email: "jesusally@hotmail.com" },
  { name: "Tan Hock Chon", email: "hctan832001@yahoo.com" },
  { name: "Farandy Angesti Liong", email: "farandy.liong@gmail.com" },
];

const API_URL = "https://sugarcane-backend-five.vercel.app/api/admin/users";
const PASSWORD = "password";

async function createFranchisee(franchisee) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: franchisee.email,
        firstName: franchisee.name,
        password: PASSWORD,
        role: "franchisee",
      }),
    });

    const data = await response.json();

    if (data.success) {
      console.log(`✅ Created: ${franchisee.name} (${franchisee.email})`);
      return { success: true, franchisee };
    } else {
      console.log(`❌ Failed: ${franchisee.name} - ${data.error}`);
      return { success: false, franchisee, error: data.error };
    }
  } catch (error) {
    console.log(`❌ Error: ${franchisee.name} - ${error.message}`);
    return { success: false, franchisee, error: error.message };
  }
}

async function main() {
  console.log(`\n🚀 Starting to seed ${franchisees.length} franchisees...\n`);

  const results = { success: [], failed: [] };

  for (const franchisee of franchisees) {
    const result = await createFranchisee(franchisee);
    if (result.success) {
      results.success.push(franchisee);
    } else {
      results.failed.push({ ...franchisee, error: result.error });
    }
    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Success: ${results.success.length}`);
  console.log(`   ❌ Failed: ${results.failed.length}`);

  if (results.failed.length > 0) {
    console.log(`\n❌ Failed franchisees:`);
    results.failed.forEach((f) => {
      console.log(`   - ${f.name} (${f.email}): ${f.error}`);
    });
  }
}

main();
