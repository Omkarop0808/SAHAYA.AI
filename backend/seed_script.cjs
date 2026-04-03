const fs = require('fs');
const path = require('path');

const ID = 'test-seed-1234-uuid';
const DATA_DIR = 'c:/dev/hackthon/intelligentAIlearningSystem/code-a-hunt/backend/data';

function write(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

function read(file) {
  if (fs.existsSync(path.join(DATA_DIR, file))) {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
  }
  return [];
}

// 1. Mark user as completed
const users = read('users.json');
const uIdx = users.findIndex(u => u.id === ID);
if (uIdx >= 0) {
  users[uIdx].hasCompletedDataCollection = true;
  write('users.json', users);
}

// 2. Set high-quality Edu Data
const eduData = read('edu_data.json');
const eIdx = eduData.findIndex(e => e.userId === ID);
const newEdu = {
  userId: ID,
  institution: "Stanford University",
  educationLevel: "Undergraduate",
  course: "B.S. Computer Science",
  semester: "6th Semester",
  specialization: "Artificial Intelligence",
  subjects: ["Machine Learning", "Algorithms", "Data Structures", "Cloud Computing"],
  updatedAt: new Date().toISOString()
};
if (eIdx >= 0) eduData[eIdx] = newEdu;
else eduData.push(newEdu);
write('edu_data.json', eduData);

// 3. Set a beautifully formatted Timetable
const ttData = read('timetables.json');
const tIdx = ttData.findIndex(t => t.userId === ID);
const newTt = {
  userId: ID,
  schedule: [
    {
      day: "Monday",
      items: [
        { time: "09:00 - 11:00", type: "study", subject: "Machine Learning", topic: "Neural Networks Fundamentals", priority: "high" },
        { time: "11:30 - 13:00", type: "break", topic: "Lunch & Rest" },
        { time: "14:00 - 16:30", type: "study", subject: "Algorithms", topic: "Dynamic Programming Approaches", priority: "high" }
      ]
    },
    {
      day: "Tuesday",
      items: [
        { time: "10:00 - 12:00", type: "study", subject: "Data Structures", topic: "Red-Black Trees", priority: "medium" },
        { time: "14:00 - 16:00", type: "study", subject: "Cloud Computing", topic: "AWS Architecture", priority: "low" }
      ]
    },
    {
      day: "Wednesday",
      items: [
        { time: "09:00 - 10:30", type: "review", subject: "Machine Learning", topic: "Review Past Papers", priority: "high" }
      ]
    }
  ],
  generatedAt: new Date().toISOString()
};
if (tIdx >= 0) ttData[tIdx] = newTt;
else ttData.push(newTt);
write('timetables.json', ttData);

// 4. Add Growth Data for impressive charts
const growthData = read('growth.json');
const filteredGrowth = growthData.filter(g => g.userId !== ID);
const newGrowth = [
  {
    userId: ID,
    subject: "Machine Learning",
    scores: [
      { label: "Quiz 1", score: 65 },
      { label: "Quiz 2", score: 78 },
      { label: "Quiz 3", score: 88 },
      { label: "Midterm", score: 95 }
    ],
    analysis: {
      strengths: ["Grasps neural net concepts easily", "Strong in optimization algorithms"],
      weaknesses: ["Backpropagation derivations need review"],
      suggestions: ["Practice deriving calculus equations for gradient descent", "Follow fast.ai deep learning course"],
      overallScore: 85,
      trend: "improving"
    },
    updatedAt: new Date().toISOString()
  },
  {
    userId: ID,
    subject: "Algorithms",
    scores: [
      { label: "Quiz 1", score: 45 },
      { label: "Quiz 2", score: 60 },
      { label: "Quiz 3", score: 85 }
    ],
    analysis: {
      strengths: ["Greedy algorithms mastery", "BFS/DFS traversal logic"],
      weaknesses: ["Dynamic programming memoization structure"],
      suggestions: ["Solve LeetCode DP problems (medium)", "Watch MIT OpenCourseWare DP lectures"],
      overallScore: 72,
      trend: "improving"
    },
    updatedAt: new Date().toISOString()
  }
];
write('growth.json', filteredGrowth.concat(newGrowth));
console.log("Database seeded successfully!");
