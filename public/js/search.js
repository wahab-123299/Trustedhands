// ===== Sample data (replace later with backend API) =====
const artisans = [
  { name: "John Doe", skill: "Electrician", location: "Lagos" },
  { name: "Mary Okoro", skill: "Plumber", location: "Abuja" },
  { name: "Aisha Bello", skill: "Painter", location: "Ibadan" },
  { name: "David King", skill: "Carpenter", location: "Lagos" },
];

const jobs = [
  { title: "Wall Painting Job", category: "Painting", location: "Ibadan", price: 12000 },
  { title: "Ceiling Fan Installation", category: "Electrical", location: "Lagos", price: 5000 },
  { title: "Pipe Fixing", category: "Plumbing", location: "Abuja", price: 7000 },
];

// ===== Elements =====
const resultsContainer = document.getElementById("results");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");

// ===== Perform search based on query =====
function performSearch(query) {
  query = query.toLowerCase().trim();
  resultsContainer.innerHTML = "";

  const artisanResults = artisans.filter(
    (a) =>
      a.name.toLowerCase().includes(query) ||
      a.skill.toLowerCase().includes(query) ||
      a.location.toLowerCase().includes(query)
  );

  const jobResults = jobs.filter(
    (j) =>
      j.title.toLowerCase().includes(query) ||
      j.category.toLowerCase().includes(query) ||
      j.location.toLowerCase().includes(query)
  );

  if (artisanResults.length === 0 && jobResults.length === 0) {
    resultsContainer.innerHTML = "<p>No results found.</p>";
    return;
  }

  artisanResults.forEach((a) => {
    const card = `
      <div class="result-card artisan">
        <h3>${a.name}</h3>
        <p><strong>Skill:</strong> ${a.skill}</p>
        <p><strong>Location:</strong> ${a.location}</p>
        <button onclick="window.location.href='find-artisan.html'">View Profile</button>
      </div>`;
    resultsContainer.insertAdjacentHTML("beforeend", card);
  });

  jobResults.forEach((j) => {
    const card = `
      <div class="result-card job">
        <h3>${j.title}</h3>
        <p><strong>Category:</strong> ${j.category}</p>
        <p><strong>Location:</strong> ${j.location}</p>
        <p><strong>Budget:</strong> ₦${j.price.toLocaleString()}</p>
        <button onclick="window.location.href='job-listings.html'">View Job</button>
      </div>`;
    resultsContainer.insertAdjacentHTML("beforeend", card);
  });
}

// ===== Detect query from URL =====
const params = new URLSearchParams(window.location.search);
const queryParam = params.get("q");
if (queryParam) {
  searchInput.value = queryParam;
  performSearch(queryParam);
}

// ===== Manual search click =====
searchBtn.addEventListener("click", () => {
  performSearch(searchInput.value);
});
// ===== Search on Enter key =====