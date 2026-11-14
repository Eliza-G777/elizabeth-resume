// Starting content for the site. Used until the admin saves edits for the first time.
export const defaultContent = {
  version: 1,
  profile: {
    name: "Elizabeth G. Taye",
    initials: "ET",
    tagline: "Grade 12 STEM student from Ethiopia, building toward computer engineering, robotics and AI.",
    location: "Addis Ababa, Ethiopia",
    email: "info.elsabetgenetu@gmail.com",
    phone: "+251 937 389 798",
    showPhone: true,
    website: "https://elizabethgenetu.netlify.app",
    github: "https://github.com/elsabetgenetu",
    linkedin: "",
    photo: null,
    about:
      "I am a top-performing Grade 12 student who has consistently ranked first in my class, with strong foundations in mathematics, programming, data structures and algorithmic problem-solving. Through AddisCoder and Yale's Young African and Global Scholars programs, I have studied algorithms, human-centered design and technology for community impact. I want to combine mathematics, computer engineering and entrepreneurship to build scalable solutions to real-world problems.",
    facts: [
      { value: "1st", label: "Zonal rank, Grade 8 regional exams" },
      { value: "3", label: "Selective Yale programs, 2025–2026" },
      { value: "Python", label: "Advanced: algorithms, data structures, OOP" }
    ]
  },
  education: [
    { id: "dangila-gss", kind: "school", when: "2025 – 2027 · present", title: "Dangila General Secondary School", place: "Dangila, Ethiopia", text: "STEM-focused track. Grades 11 and 12, with high distinction in STEM.", badge: "", current: true },
    { id: "lemlem", kind: "school", when: "2024 – 2025", title: "Lemlem Academy", place: "Addis Ababa, Ethiopia", text: "STEM-focused track. Grade 10, with high distinction in STEM, completed while internally displaced.", badge: "", current: false },
    { id: "interrupted", kind: "note", when: "2024", title: "Education interrupted", place: "", text: "The civil war in Ethiopia interrupted my schooling. While internally displaced, I continued my studies in Addis Ababa, then returned to Dangila to finish secondary school.", badge: "", current: false },
    { id: "hidasie", kind: "school", when: "2023 – 2024", title: "Hidasie Dangila School", place: "Dangila, Ethiopia", text: "STEM-focused track. Grade 9, with high distinction in STEM.", badge: "", current: false },
    { id: "amen", kind: "school", when: "2016 – 2022", title: "Amen Elementary and Middle School", place: "Dangila, Ethiopia", text: "Grades 1–8. Placed 1st in the zone in Grade 8, the top performer across the region.", badge: "1st place", current: false }
  ],
  achievements: [
    {
      id: "yale-young-global-scholars-2026", section: "programs", category: "Summer program",
      title: "Yale Young Global Scholars (YYGS)", org: "Yale University", dates: "Jul – Aug 2026", year: "2026",
      track: "Innovations in Science and Technology",
      summary: "A selective summer program at Yale for high school students from around the world.",
      bullets: [
        "Explored technology-driven solutions to real-world problems through STEM seminars and discussions.",
        "Built research, analytical thinking, teamwork and presentation skills through collaborative projects and a capstone."
      ],
      tags: ["Research", "Capstone", "STEM"], files: []
    },
    {
      id: "yale-entrepreneurial-society-2026", section: "programs", category: "Fellowship",
      title: "Yale Entrepreneurial Society (YES) Fellow", org: "Yale University", dates: "Mar – May 2026", year: "2026",
      track: "",
      summary: "A spring fellowship on entrepreneurship and building startup ideas.",
      bullets: [
        "Built skills in entrepreneurship, problem-solving and opportunity identification through workshops.",
        "Developed and pitched startup ideas with peers, gaining experience in teamwork, pitching and innovation."
      ],
      tags: ["Entrepreneurship", "Pitching"], files: []
    },
    {
      id: "yale-young-african-scholars-2025", section: "programs", category: "Summer program",
      title: "Yale Young African Scholars (YYAS)", org: "Yale University", dates: "Jul – Aug 2025", year: "2025",
      track: "Innovations in Science and Technology",
      summary: "Yale's selective academic program for African secondary school students.",
      bullets: [
        "Took part in university-style seminars, lectures and workshops on science and global issues.",
        "Developed skills in scientific writing, communication and collaborative problem-solving.",
        "Completed the Designing for Impact seminar, applying human-centered design to technology solutions for community challenges in Ethiopia."
      ],
      tags: ["Human-centered design", "Scientific writing"], files: []
    },
    {
      id: "addiscoder-2023", section: "programs", category: "Computer science program",
      title: "AddisCoder", org: "Addis Ababa Institute of Technology (AAIT)", dates: "Jul – Aug 2023", year: "2023",
      track: "",
      summary: "A rigorous, selective computer science program taught by Harvard and UC Berkeley faculty.",
      bullets: [
        "Focused on algorithmic problem-solving and computational thinking.",
        "Learned core CS concepts and analyzed algorithms for time and space complexity.",
        "Worked hands-on in Linux, on the command line, and with Git and GitHub for version control."
      ],
      tags: ["Python", "Recursion", "Trees", "Stacks", "Queues", "Graph algorithms", "Complexity analysis"], files: []
    },
    {
      id: "science-innovation-club", section: "leadership", category: "Leadership",
      title: "Science and Innovation Club", org: "Lemlem Academy", dates: "2024 – present", year: "2024",
      track: "",
      summary: "An active member driving the club's STEM work.",
      bullets: [
        "Drive STEM initiatives, collaborative research projects and peer-to-peer learning sessions.",
        "Lead discussions on emerging technologies, innovation methods and scientific inquiry to build a culture of curiosity and problem-solving."
      ],
      tags: ["Peer teaching", "Research"], files: []
    },
    {
      id: "udemy-fundamental-programming", section: "honors", category: "Certificate",
      title: "Fundamental Programming", org: "Udemy", dates: "2025", year: "2025",
      track: "", summary: "Online course certificate in programming fundamentals.", bullets: [], tags: [], files: []
    },
    {
      id: "grade-11-certificate", section: "honors", category: "Academic honor",
      title: "Grade 11 Completion Certificate", org: "Dangila General Secondary School", dates: "With High Distinction", year: "Gr 11",
      track: "", summary: "Completed Grade 11 with high distinction in STEM.", bullets: [], tags: [], files: []
    },
    {
      id: "grade-9-10-certificates", section: "honors", category: "Academic honor",
      title: "Grade 9 and 10 Completion Certificates", org: "Hidasie Dangila School and Lemlem Academy", dates: "With High Distinction", year: "Gr 9–10",
      track: "", summary: "Completed Grades 9 and 10 with high distinction in STEM.", bullets: [], tags: [], files: []
    },
    {
      id: "grade-8-regional-excellence", section: "honors", category: "Academic honor",
      title: "Grade 8 Regional Excellence Certificate", org: "Amen Elementary and Middle School", dates: "1st Place Zonal Ranking", year: "2022",
      track: "", summary: "Ranked 1st in the zone in the Grade 8 regional exams, the top performer across the region.", bullets: [], tags: [], files: []
    }
  ],
  skills: [
    { id: "lang", group: "Programming languages", items: ["Python (advanced)", "Algorithms", "Data structures", "OOP", "HTML / CSS"] },
    { id: "cs", group: "Computer science foundations", items: ["Algorithms", "Data structures", "Recursion", "Graph theory", "Complexity analysis", "Problem decomposition"] },
    { id: "tools", group: "Development tools", items: ["Linux / Unix", "VS Code", "Git & GitHub", "Terminal"] },
    { id: "interests", group: "Areas of interest", items: ["Robotics", "Computer engineering", "AI & machine learning", "Engineering design", "Applied research", "Innovation & entrepreneurship"] }
  ]
};
