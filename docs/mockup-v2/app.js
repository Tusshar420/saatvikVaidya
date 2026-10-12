const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const toast = $('#toast');
let toastTimer;

function showToast(message) {
  $('span', toast).textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

$$('[data-toast]').forEach((button) => {
  button.addEventListener('click', () => showToast(button.dataset.toast));
});

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.09 });

$$('.reveal').forEach((item) => revealObserver.observe(item));

const navLinks = $$('.nav-link');
const sections = $$('main section[id], #top');
const navObserver = new IntersectionObserver((entries) => {
  const active = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  if (!active) return;
  navLinks.forEach((link) => {
    const target = link.getAttribute('href').slice(1);
    link.classList.toggle('active', target === active.target.id);
  });
}, { rootMargin: '-28% 0px -62% 0px', threshold: [0, .2, .5] });
sections.forEach((section) => navObserver.observe(section));

const talkContent = {
  latest: {
    initials: 'VS', name: 'Dr. Vedika Sharma', specialty: 'Verified Doctor · Kayachikitsa',
    question: 'How do you personalise Pathya when Agni and disease stage indicate different priorities?',
    meta: ['12 helpful answers', '38 doctors joined']
  },
  questions: {
    initials: 'AK', name: 'Dr. Ankit Kulkarni', specialty: 'Verified Doctor · Panchakarma',
    question: 'Which clinical observations do you document before deciding the sequence of Shodhana and Shamana?',
    meta: ['9 helpful answers', '24 doctors joined']
  },
  cases: {
    initials: 'NR', name: 'Dr. Neha Rathi', specialty: 'Verified Doctor · Stri Roga',
    question: 'Case discussion: a practical framework for documenting Prakriti, Agni and treatment response over time.',
    meta: ['Case de-identified', '17 doctors joined']
  }
};

$$('[data-talk-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    $$('[data-talk-tab]').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    const item = talkContent[button.dataset.talkTab];
    $('#talk-content').innerHTML = `
      <div class="doctor-avatar">${item.initials}</div>
      <div>
        <div class="doctor-line"><b>${item.name}</b><span><svg><use href="#i-check"></use></svg></span></div>
        <small>${item.specialty}</small>
        <p>${item.question}</p>
        <div class="discussion-meta"><span>${item.meta[0]}</span><span>${item.meta[1]}</span></div>
      </div>`;
  });
});

$$('.quantity-options button').forEach((button) => {
  button.addEventListener('click', () => {
    $$('.quantity-options button').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    $('#net-rate').innerHTML = `₹${button.dataset.rate} <em>/unit</em>`;
    $('#selected-qty').textContent = `${button.dataset.qty} units`;
  });
});

function openModal(modal) {
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

function closeModal(modal) {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  if (modal.id === 'quiz-modal') clearInterval(timerInterval);
}

$$('[data-close-modal]').forEach((button) => {
  button.addEventListener('click', () => closeModal(button.closest('.modal')));
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') $$('.modal.open').forEach(closeModal);
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    const search = $('.header-search input');
    if (search) search.focus();
  }
});

$$('[data-open-profile]').forEach((button) => {
  button.addEventListener('click', () => openModal($('#profile-modal')));
});

$$('.role-options button').forEach((button) => {
  button.addEventListener('click', () => {
    $$('.role-options button').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
  });
});

$('[data-send-otp]').addEventListener('click', () => {
  const phone = $('.phone-field input').value.trim();
  if (!/^\d{10}$/.test(phone)) {
    showToast('Please enter a valid 10-digit mobile number');
    return;
  }
  closeModal($('#profile-modal'));
  showToast('OTP journey ready for backend integration');
});

const quizQuestions = [
  {
    question: 'In Ayurveda, which concept is most directly related to digestion and metabolic transformation?',
    options: ['Agni', 'Ojas', 'Dhatu', 'Srotas'], answer: 0
  },
  {
    question: 'Pathya is best understood as:',
    options: ['A fixed diet for every patient', 'What supports the treatment pathway', 'Only a list of restricted foods', 'A seasonal medicine'], answer: 1
  },
  {
    question: 'Before advising Ahara, the most appropriate approach is to consider:',
    options: ['Only the disease name', 'Only body weight', 'Prakriti, Agni and disease stage', 'Only patient age'], answer: 2
  }
];

let quizIndex = 0;
let quizScore = 0;
let timerInterval;

function renderQuiz() {
  const stage = $('#quiz-stage');
  const progress = $('#quiz-progress');
  progress.style.width = `${((quizIndex + 1) / quizQuestions.length) * 100}%`;
  const item = quizQuestions[quizIndex];
  stage.innerHTML = `
    <span class="question-count">QUESTION ${quizIndex + 1} OF ${quizQuestions.length}</span>
    <h3 class="question-title">${item.question}</h3>
    <div class="answer-list">
      ${item.options.map((option, index) => `<button data-answer="${index}">${String.fromCharCode(65 + index)}. ${option}</button>`).join('')}
    </div>`;
  $$('[data-answer]', stage).forEach((answer) => {
    answer.addEventListener('click', () => {
      if (Number(answer.dataset.answer) === item.answer) quizScore += 1;
      quizIndex += 1;
      if (quizIndex < quizQuestions.length) renderQuiz(); else renderQuizResult();
    });
  });
}

function renderQuizResult() {
  clearInterval(timerInterval);
  $('#quiz-progress').style.width = '100%';
  $('#quiz-stage').innerHTML = `
    <div class="quiz-result">
      <div class="result-ring">${quizScore}/${quizQuestions.length}</div>
      <h3>Challenge complete!</h3>
      <p>You explored three practical questions on Agni and Ahara. Detailed explanations can appear after every answer in the final platform.</p>
      <button class="btn btn-green full" data-share-result>Share My Result</button>
    </div>`;
  $('[data-share-result]').addEventListener('click', () => showToast('Shareable result card ready'));
}

function startTimer() {
  clearInterval(timerInterval);
  let seconds = 300;
  $('#timer').textContent = '05:00';
  timerInterval = setInterval(() => {
    seconds -= 1;
    const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
    const remaining = String(seconds % 60).padStart(2, '0');
    $('#timer').textContent = `${minutes}:${remaining}`;
    if (seconds <= 0) renderQuizResult();
  }, 1000);
}

$$('[data-open-quiz]').forEach((button) => {
  button.addEventListener('click', () => {
    quizIndex = 0;
    quizScore = 0;
    renderQuiz();
    startTimer();
    openModal($('#quiz-modal'));
  });
});

$$('[data-reel]').forEach((card) => {
  card.addEventListener('click', () => {
    $('#reel-title').textContent = card.dataset.reel;
    openModal($('#reel-modal'));
  });
});

$$('.filter-pills button').forEach((button) => {
  button.addEventListener('click', () => {
    $$('.filter-pills button').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    showToast(`${button.textContent} reels selected`);
  });
});

const searchInput = $('.header-search input');
searchInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && searchInput.value.trim()) {
    showToast(`Searching for “${searchInput.value.trim()}”`);
    searchInput.blur();
  }
});

$$('.mobile-dock a').forEach((link) => {
  link.addEventListener('click', () => {
    $$('.mobile-dock a').forEach((item) => item.classList.remove('active'));
    link.classList.add('active');
  });
});
