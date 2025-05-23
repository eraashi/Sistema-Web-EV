let students = [];
let classes = [];
let enrollments = [];
let activeClasses = [];
let polos = [];
let studentsWithoutEnrollments = [];
let poloSelecionado = "all";
let periodoInicio = new Date(new Date().setDate(new Date().getDate() - 30));
let periodoFim = new Date();

// Pagination state
const STUDENTS_PER_PAGE = 10;
let enrolledStudentsCurrentPage = 1;
let availableStudentsCurrentPage = 1;
let enrolledStudentsTotalPages = 1;
let availableStudentsTotalPages = 1;

// Chart instances to allow destruction
let frequenciaChart = null;
let alunosDisciplinaChart = null;
let alunosPeriodoChart = null;
let alunosFaixaEtariaChart = null;
let alunosNovosChart = null;
let trocasTurmaChart = null;
let evasaoChart = null;
let retornoChart = null;
let evasaoPorTurmaChart = null;
let retornoPorTurmaChart = null;

const COLORS = ['#1E3A8A', '#3B82F6', '#60A5FA', '#93C5FD', '#F97316', '#F59E0B', '#EF4444', '#10B981'];

const frequenciaData = [
    { name: 'Jan', frequencia: 95 },
    { name: 'Fev', frequencia: 92 },
    { name: 'Mar', frequencia: 93 },
    { name: 'Abr', frequencia: 89 },
    { name: 'Mai', frequencia: 94 },
];

const alunosPorDisciplina = [
    { name: 'Robótica', value: 120 },
    { name: 'Inglês', value: 110 },
    { name: 'Jiu-Jitsu', value: 85 },
    { name: 'Karatê', value: 70 },
    { name: 'Hip-Hop', value: 65 },
    { name: 'Violão', value: 55 },
    { name: 'Teclado', value: 50 },
    { name: 'Balé', value: 45 },
];

const alunosPorPeriodo = [
    { name: 'Manhã', value: 320 },
    { name: 'Tarde', value: 280 },
];

const alunosPorFaixaEtaria = [
    { name: '4º-5º ano', alunos: 240 },
    { name: '6º-7º ano', alunos: 210 },
    { name: '8º-9º ano', alunos: 150 },
];

const alunosNovosData = [
    { name: 'Jan', alunos: 20 },
    { name: 'Fev', alunos: 25 },
    { name: 'Mar', alunos: 30 },
    { name: 'Abr', alunos: 15 },
    { name: 'Mai', alunos: 30 },
];

const trocasTurmaData = [
    { name: 'Jan', trocas: 5 },
    { name: 'Fev', trocas: 8 },
    { name: 'Mar', trocas: 10 },
    { name: 'Abr', trocas: 7 },
    { name: 'Mai', trocas: 5 },
];

const evasaoData = [
    { name: 'Jan', evasao: 15 },
    { name: 'Fev', evasao: 20 },
    { name: 'Mar', evasao: 25 },
    { name: 'Abr', evasao: 10 },
    { name: 'Mai', evasao: 18 },
];

const retornoData = [
    { name: 'Jan', retorno: 5 },
    { name: 'Fev', retorno: 8 },
    { name: 'Mar', retorno: 12 },
    { name: 'Abr', retorno: 7 },
    { name: 'Mai', retorno: 10 },
];

const evasaoPorTurma = [
    { name: 'Robótica', evasao: 30 },
    { name: 'Inglês', evasao: 25 },
    { name: 'Jiu-Jitsu', evasao: 20 },
    { name: 'Karatê', evasao: 15 },
    { name: 'Balé', evasao: 10 },
];

const retornoPorTurma = [
    { name: 'Inglês', retorno: 15 },
    { name: 'Robótica', retorno: 12 },
    { name: 'Hip-Hop', retorno: 10 },
    { name: 'Violão', retorno: 8 },
    { name: 'Teclado', retorno: 5 },
];

// Função de retentativa para requisições
const retryFetch = async (url, options, retries = 2, delay = 500) => {
    const cacheKey = `cache_${url}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        try {
            const { data, timestamp } = JSON.parse(cached);
            let isValid = Date.now() - timestamp < 300000 && data; // TTL de 5 minutos (300.000 ms)
            if (url.includes('/api/dashboard_data')) {
                isValid = isValid && 
                    Array.isArray(data.turmas) && data.turmas.length > 0 && 
                    data.alunos && Array.isArray(data.alunos.data) && data.alunos.data.length > 0 && 
                    data.turmas_ativas && Array.isArray(data.turmas_ativas.turmas);
            } else if (url.includes('/api/polos')) {
                isValid = isValid && Array.isArray(data);
            } else {
                isValid = isValid && Array.isArray(data);
            }

            if (isValid) {
                return data;
            } else {
                localStorage.removeItem(cacheKey);
            }
        } catch (e) {
            localStorage.removeItem(cacheKey);
        }
    }

    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                throw new Error(`Erro HTTP! Status: ${response.status}`);
            }
            const data = await response.json();
            try {
                localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
            } catch (e) {}
            return data;
        } catch (error) {
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw error;
            }
        }
    }
};

// Função de debounce para limitar chamadas ao filtro
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

async function fetchData() {
    const overlay = document.getElementById('loading-overlay');
    const mainContent = document.getElementById('main-content');

    if (overlay && mainContent) {
        overlay.classList.remove('hidden');
        mainContent.classList.add('pointer-events-none');
    }

    try {
        students = [];
        classes = [];
        enrollments = [];
        activeClasses = [];
        polos = [];
        studentsWithoutEnrollments = [];

        let isRendered = false;
        const cacheKey = 'cache_/api/dashboard_data';
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                const { data, timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp < 300000 && 
                    data && 
                    Array.isArray(data.turmas) && data.turmas.length > 0 && 
                    Array.isArray(data.alunos?.data) && data.alunos.data.length > 0) {
                    students = data.alunos.data;
                    classes = data.turmas;
                    enrollments = data.matriculas || [];
                    activeClasses = data.turmas_ativas?.turmas || [];
                    polos = [];
                    studentsWithoutEnrollments = students.filter(student => {
                        return !enrollments.some(e => String(e.studentId).toLowerCase().trim() === String(student.id).toLowerCase().trim());
                    });
                    isRendered = true;
                    renderReports(data.turmas_ativas?.current_period || 'tarde', data.turmas_ativas?.current_day || null);
                } else {
                    localStorage.removeItem(cacheKey);
                }
            } catch (e) {
                localStorage.removeItem(cacheKey);
            }
        }

        const data = await retryFetch('/api/dashboard_data', { credentials: 'include' });
        students = Array.isArray(data.alunos?.data) ? data.alunos.data : [];
        classes = Array.isArray(data.turmas) ? data.turmas : [];
        enrollments = Array.isArray(data.matriculas) ? data.matriculas : [];
        activeClasses = Array.isArray(data.turmas_ativas?.turmas) ? data.turmas_ativas.turmas : [];
        polos = [];
        studentsWithoutEnrollments = students.filter(student => {
            return !enrollments.some(e => String(e.studentId).toLowerCase().trim() === String(student.id).toLowerCase().trim());
        });

        if (!isRendered || polos.length === 0) {
            try {
                const polosData = await retryFetch('/api/polos', { credentials: 'include' });
                polos = Array.isArray(polosData) ? polosData : [];
            } catch (e) {
                polos = [];
            }
        }

        if (!isRendered || classes.length > 0 || students.length > 0) {
            renderReports(data.turmas_ativas?.current_period || 'tarde', data.turmas_ativas?.current_day || null);
        }

        if (overlay && mainContent) {
            overlay.classList.add('hidden');
            mainContent.classList.remove('pointer-events-none');
        }
    } catch (error) {
        showToast('Erro ao carregar dados: ' + error.message, 'error', 'alert-circle');
        renderReports('tarde', null);
        if (overlay && mainContent) {
            overlay.classList.add('hidden');
            mainContent.classList.remove('pointer-events-none');
        }
    }
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

function extractClassName(name) {
    if (!name) return '';
    const match = name.match(/^[^0-9]+/i);
    return match ? match[0].trim() : name;
}

function formatSchedule(day, period, includePeriod = true) {
    const days = {
        monday: 'Segunda',
        tuesday: 'Terça',
        wednesday: 'Quarta',
        thursday: 'Quinta',
        friday: 'Sexta',
        seg: 'Segunda',
        ter: 'Terça',
        qua: 'Quarta',
        qui: 'Quinta',
        sex: 'Sexta'
    };
    const periods = {
        morning: 'Manhã',
        afternoon: 'Tarde',
        manha: 'Manhã',
        tarde: 'Tarde'
    };
    const formattedDay = days[day] || day;
    const formattedPeriod = periods[period] || period;
    return includePeriod ? `${formattedDay} (${formattedPeriod})` : formattedDay;
}

function formatGrades(grades) {
    if (!grades) return 'Não especificado';
    let gradesString = Array.isArray(grades) ? grades.join(',') : grades;
    try {
        return gradesString.split(',').map(g => `${g.trim()}º`).join(' e ');
    } catch (error) {
        return 'Não especificado';
    }
}

function formatarNumero(numero) {
    return numero.toLocaleString('pt-BR');
}

function showToast(message, type, icon) {
    const toastContainer = document.getElementById('custom-toast-container');
    if (!toastContainer) {
        return;
    }

    const toastDiv = document.createElement('div');
    toastDiv.className = `custom-toast custom-toast-${type}`;
    toastDiv.innerHTML = `
        <i data-lucide="${icon}" class="custom-toast-icon h-3 w-3"></i>
        <span class="custom-toast-message">${message}</span>
        <button class="custom-toast-close">×</button>
    `;

    toastContainer.appendChild(toastDiv);

    lucide.createIcons();

    const timeout = setTimeout(() => {
        toastDiv.remove();
    }, 3000);

    const closeButton = toastDiv.querySelector('.custom-toast-close');
    closeButton.addEventListener('click', () => {
        clearTimeout(timeout);
        toastDiv.remove();
    });
}

function openStudentsModal(classId) {
    const cls = activeClasses.find(c => c.id === classId);
    if (!cls) {
        showToast('Turma não encontrada', 'error', 'alert-circle');
        return;
    }

    const modal = document.getElementById('students-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalStudents = document.getElementById('modal-students');

    modalTitle.textContent = `Alunos Matriculados - ${capitalizeFirstLetter(extractClassName(cls.name))}`;
    modalStudents.innerHTML = cls.students.length === 0 ?
        '<div class="text-center py-4 text-gray-500">Nenhum aluno matriculado.</div>' :
        cls.students.map(student => `
            <div class="flex items-center p-3 border rounded-md hover:bg-gray-50">
                <div class="h-10 w-10 rounded-full bg-blue-600 text-white flex items-center justify-center mr-3">
                    ${student.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)}
                </div>
                <div>
                    <p class="font-medium">${student.name}</p>
                    <p class="text-sm text-gray-500">${student.unidade || 'Não especificado'}</p>
                </div>
            </div>
        `).join('');

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modal = document.getElementById('students-modal');
    modal.classList.add('hidden');
    document.body.style.overflow = '';
}

document.getElementById('students-modal').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) {
        closeModal();
    }
});

// Helper function to render student list HTML
function renderStudentList(students, containerId, isEnrolled) {
    const div = document.getElementById(containerId);
    div.innerHTML = students.length === 0 ?
        `<div class="text-center py-4 text-gray-500">Nenhum aluno ${isEnrolled ? 'matriculado' : 'disponível'}.</div>` :
        students.map(student => `
            <div class="flex items-center justify-between p-3 border rounded-md hover:bg-gray-50">
                <div class="flex items-center">
                    <div class="h-10 w-10 rounded-full bg-blue-600 text-white flex items-center justify-center mr-3">
                        ${student.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)}
                    </div>
                    <div>
                        <p class="font-medium">${student.name}</p>
                        <p class="text-sm text-gray-500">ID: ${student.id} | ${student.etapa}</p>
                        ${isEnrolled ? `
                            <p class="text-sm text-gray-500">Turmas: ${
                                enrollments
                                    .filter(e => String(e.studentId).toLowerCase().trim() === String(student.id).toLowerCase().trim())
                                    .map(e => classes.find(c => c.id === e.classId)?.name || '')
                                    .join(', ')
                            }</p>
                        ` : ''}
                    </div>
                </div>
            </div>
        `).join('');
}

// Helper function to render pagination controls
function renderPagination(containerId, currentPage, totalPages, onPageChange) {
    const div = document.getElementById(containerId);
    div.innerHTML = '';
    if (totalPages <= 1) return;

    const prevButton = document.createElement('button');
    prevButton.textContent = 'Anterior';
    prevButton.className = `px-3 py-1 rounded-md ${currentPage === 1 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`;
    prevButton.disabled = currentPage === 1;
    prevButton.onclick = () => currentPage > 1 && onPageChange(currentPage - 1);
    div.appendChild(prevButton);

    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    if (endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.className = `px-3 py-1 rounded-md ${i === currentPage ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`;
        pageButton.onclick = () => onPageChange(i);
        div.appendChild(pageButton);
    }

    const nextButton = document.createElement('button');
    nextButton.textContent = 'Próximo';
    nextButton.className = `px-3 py-1 rounded-md ${currentPage === totalPages ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`;
    nextButton.disabled = currentPage === totalPages;
    nextButton.onclick = () => currentPage < totalPages && onPageChange(currentPage + 1);
    div.appendChild(nextButton);
}

function filterAvailableStudents(page = 1, search = '') {
    const availableStudents = search ?
        studentsWithoutEnrollments.filter(student => {
            const matchesSearch = student.name.toLowerCase().includes(search.toLowerCase()) || student.id.toLowerCase().includes(search.toLowerCase());
            return matchesSearch;
        }) :
        studentsWithoutEnrollments;

    availableStudentsTotalPages = Math.ceil(availableStudents.length / STUDENTS_PER_PAGE);
    availableStudentsCurrentPage = Math.min(page, availableStudentsTotalPages) || 1;
    const start = (availableStudentsCurrentPage - 1) * STUDENTS_PER_PAGE;
    const end = start + STUDENTS_PER_PAGE;
    const paginatedStudents = availableStudents.slice(start, end);

    renderStudentList(paginatedStudents, 'available-students', false);
    renderPagination('available-students-pagination', availableStudentsCurrentPage, availableStudentsTotalPages, newPage => {
        filterAvailableStudents(newPage, search);
    });
}

function renderFrequenciaChart() {
    if (frequenciaChart) {
        frequenciaChart.destroy();
    }

    const frequenciaCtx = document.getElementById('frequencia-chart').getContext('2d');
    frequenciaChart = new Chart(frequenciaCtx, {
        type: 'line',
        data: {
            labels: frequenciaData.map(d => d.name),
            datasets: [{
                label: 'Frequência (%)',
                data: frequenciaData.map(d => d.frequencia),
                borderColor: '#1E3A8A',
                fill: false,
                tension: 0.1,
                pointRadius: 5,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1000,
                easing: 'easeOutQuart',
                y: { from: 80 },
                opacity: { from: 0, to: 1 }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    min: 80,
                    max: 100
                }
            },
            plugins: {
                legend: { position: 'bottom' },
                tooltip: { enabled: true }
            }
        }
    });
}

function renderDistribuicaoCharts() {
    if (alunosDisciplinaChart) {
        alunosDisciplinaChart.destroy();
    }
    if (alunosPeriodoChart) {
        alunosPeriodoChart.destroy();
    }
    if (alunosFaixaEtariaChart) {
        alunosFaixaEtariaChart.destroy();
    }

    const alunosDisciplinaCtx = document.getElementById('alunos-por-disciplina-chart').getContext('2d');
    alunosDisciplinaChart = new Chart(alunosDisciplinaCtx, {
        type: 'bar',
        data: {
            labels: alunosPorDisciplina.map(d => d.name),
            datasets: [{
                label: 'Alunos',
                data: alunosPorDisciplina.map(d => d.value),
                backgroundColor: '#1E3A8A'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            },
            indexAxis: 'y',
            scales: {
                x: { beginAtZero: true }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });

    const alunosPeriodoCtx = document.getElementById('alunos-por-periodo-chart').getContext('2d');
    alunosPeriodoChart = new Chart(alunosPeriodoCtx, {
        type: 'pie',
        data: {
            labels: alunosPorPeriodo.map(d => d.name),
            datasets: [{
                data: alunosPorPeriodo.map(d => d.value),
                backgroundColor: COLORS.slice(0, 2)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            },
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.label}: ${context.raw} (${((context.raw / alunosPorPeriodo.reduce((a, b) => a + b.value, 0)) * 100).toFixed(0)}%)`
                    }
                }
            }
        }
    });

    const alunosFaixaEtariaCtx = document.getElementById('alunos-por-faixa-etaria-chart').getContext('2d');
    alunosFaixaEtariaChart = new Chart(alunosFaixaEtariaCtx, {
        type: 'bar',
        data: {
            labels: alunosPorFaixaEtaria.map(d => d.name),
            datasets: [{
                label: 'Alunos',
                data: alunosPorFaixaEtaria.map(d => d.alunos),
                backgroundColor: '#3B82F6'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            },
            scales: {
                y: { beginAtZero: true }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function renderMovimentacaoCharts() {
    if (alunosNovosChart) {
        alunosNovosChart.destroy();
    }
    if (trocasTurmaChart) {
        trocasTurmaChart.destroy();
    }
    if (evasaoChart) {
        evasaoChart.destroy();
    }
    if (retornoChart) {
        retornoChart.destroy();
    }
    if (evasaoPorTurmaChart) {
        evasaoPorTurmaChart.destroy();
    }
    if (retornoPorTurmaChart) {
        retornoPorTurmaChart.destroy();
    }

    const alunosNovosCtx = document.getElementById('alunos-novos-chart').getContext('2d');
    alunosNovosChart = new Chart(alunosNovosCtx, {
        type: 'line',
        data: {
            labels: alunosNovosData.map(d => d.name),
            datasets: [{
                label: 'Alunos Novos',
                data: alunosNovosData.map(d => d.alunos),
                borderColor: '#1E3A8A',
                fill: false,
                tension: 0.1,
                pointRadius: 5,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1000,
                easing: 'easeOutQuart',
                y: { from: 0 },
                opacity: { from: 0, to: 1 }
            },
            scales: {
                y: { beginAtZero: true }
            },
            plugins: {
                legend: { position: 'bottom' },
                tooltip: { enabled: true }
            }
        }
    });

    const trocasTurmaCtx = document.getElementById('trocas-turma-chart').getContext('2d');
    trocasTurmaChart = new Chart(trocasTurmaCtx, {
        type: 'bar',
        data: {
            labels: trocasTurmaData.map(d => d.name),
            datasets: [{
                label: 'Trocas de Turma',
                data: trocasTurmaData.map(d => d.trocas),
                backgroundColor: '#3B82F6'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            },
            scales: {
                y: { beginAtZero: true }
            },
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });

    const evasaoCtx = document.getElementById('evasao-chart').getContext('2d');
    evasaoChart = new Chart(evasaoCtx, {
        type: 'line',
        data: {
            labels: evasaoData.map(d => d.name),
            datasets: [{
                label: 'Evasão',
                data: evasaoData.map(d => d.evasao),
                borderColor: '#EF4444',
                fill: false,
                tension: 0.1,
                pointRadius: 5,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1000,
                easing: 'easeOutQuart',
                y: { from: 0 },
                opacity: { from: 0, to: 1 }
            },
            scales: {
                y: { beginAtZero: true }
            },
            plugins: {
                legend: { position: 'bottom' },
                tooltip: { enabled: true }
            }
        }
    });

    const retornoCtx = document.getElementById('retorno-chart').getContext('2d');
    retornoChart = new Chart(retornoCtx, {
        type: 'line',
        data: {
            labels: retornoData.map(d => d.name),
            datasets: [{
                label: 'Retorno',
                data: retornoData.map(d => d.retorno),
                borderColor: '#10B981',
                fill: false,
                tension: 0.1,
                pointRadius: 5,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1000,
                easing: 'easeOutQuart',
                y: { from: 0 },
                opacity: { from: 0, to: 1 }
            },
            scales: {
                y: { beginAtZero: true }
            },
            plugins: {
                legend: { position: 'bottom' },
                tooltip: { enabled: true }
            }
        }
    });

    const evasaoPorTurmaCtx = document.getElementById('evasao-por-turma-chart').getContext('2d');
    evasaoPorTurmaChart = new Chart(evasaoPorTurmaCtx, {
        type: 'bar',
        data: {
            labels: evasaoPorTurma.map(d => d.name),
            datasets: [{
                label: 'Evasão',
                data: evasaoPorTurma.map(d => d.evasao),
                backgroundColor: '#EF4444'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            },
            scales: {
                y: { beginAtZero: true }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });

    const retornoPorTurmaCtx = document.getElementById('retorno-por-turma-chart').getContext('2d');
    retornoPorTurmaChart = new Chart(retornoPorTurmaCtx, {
        type: 'bar',
        data: {
            labels: retornoPorTurma.map(d => d.name),
            datasets: [{
                label: 'Retorno',
                data: retornoPorTurma.map(d => d.retorno),
                backgroundColor: '#10B981'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            },
            scales: {
                y: { beginAtZero: true }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function renderReports(currentPeriod, currentDay) {
    document.getElementById('current-period').textContent = currentPeriod === 'manha' ? 'Manhã' : 'Tarde';
    document.getElementById('current-day').textContent = currentDay ? formatSchedule(currentDay, null, false) : 'Sem aulas hoje';

    document.getElementById('active-classes-count').textContent = `${activeClasses.length} turmas ativas`;

    const activeClassesDiv = document.getElementById('active-classes');
    activeClassesDiv.innerHTML = activeClasses.length === 0 ?
        '<div class="text-center py-4 text-gray-500 col-span-full">Nenhuma turma ativa no momento.</div>' :
        activeClasses.map(cls => {
            const className = extractClassName(cls.name);
            const capitalizedName = capitalizeFirstLetter(className);
            const classType = cls.type === 'cognitiva' ? 'Cognitiva' : 'Motora';
            return `
                <div class="card bg-gray-50 border border-blue-300 rounded-lg p-5 shadow-md transition-all duration-300 hover:bg-blue-50 hover:shadow-xl">
                    <h3 style="font-size: 1.125rem; font-weight: 600; color: #111827; display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
                        ${capitalizedName}
                        <span class="class-type-tag ${cls.type} inline-block px-2 py-1 rounded-full text-xs font-medium text-white">
                            ${classType}
                        </span>
                    </h3>
                    <div class="text-sm text-gray-700 space-y-2">
                        <div class="flex items-center gap-2">
                            <i data-lucide="calendar" class="h-4 w-4 text-blue-500"></i>
                            <span>${formatSchedule(cls.day, cls.period, false)}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <i data-lucide="clock" class="h-4 w-4 text-blue-500"></i>
                            <span>${formatSchedule(cls.day, cls.period).split('(')[1].replace(')', '')}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <i data-lucide="graduation-cap" class="h-4 w-4 text-blue-500"></i>
                            <span>${formatGrades(cls.grades)}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <i data-lucide="school" class="h-4 w-4 text-blue-500"></i>
                            <span>${cls.polo_name || 'Não especificado'}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <i data-lucide="users" class="h-4 w-4 text-blue-500"></i>
                            <span>${cls.enrollmentCount}/${cls.capacity}</span>
                        </div>
                    </div>
                    <button onclick="openStudentsModal('${cls.id}')" style="background-color: #3b82f6; color: white; padding: 0.5rem 1rem; border-radius: 0.375rem; margin-top: 1rem; display: flex; align-items: center; justify-content: center; font-size: 0.875rem; transition: background-color: 0.2s;">
                        <i data-lucide="users" class="h-4 w-4 mr-1"></i>
                        Ver Alunos (${cls.enrollmentCount})
                    </button>
                </div>
            `;
        }).join('');

    const estatisticasGerais = {
        totalAlunos: students.length,
        mediaFrequencia: 92.5,
        alunosNovos: alunosNovosData.reduce((sum, d) => sum + d.alunos, 0),
        trocasTurma: trocasTurmaData.reduce((sum, d) => sum + d.trocas, 0)
    };
    document.getElementById('total-alunos').textContent = formatarNumero(estatisticasGerais.totalAlunos);
    document.getElementById('media-frequencia').textContent = `${estatisticasGerais.mediaFrequencia}%`;
    document.getElementById('alunos-novos').textContent = formatarNumero(estatisticasGerais.alunosNovos);
    document.getElementById('trocas-turma').textContent = formatarNumero(estatisticasGerais.trocasTurma);

    const totalCapacity = classes.reduce((sum, cls) => sum + cls.capacity, 0);
    const totalEnrolled = enrollments.length;
    const occupancyRate = totalCapacity ? (totalEnrolled / totalCapacity * 100).toFixed(0) : 0;
    document.getElementById('occupancy-rate').textContent = `${occupancyRate}%`;
    document.getElementById('occupancy-details').textContent = `${totalEnrolled} alunos matriculados de ${totalCapacity} vagas totais`;

    const enrolledStudents = Array.isArray(students) ? students.filter(student => enrollments.some(e => String(e.studentId).toLowerCase().trim() === String(student.id).toLowerCase().trim())) : [];
    enrolledStudentsTotalPages = Math.ceil(enrolledStudents.length / STUDENTS_PER_PAGE);
    enrolledStudentsCurrentPage = 1;
    const startEnrolled = (enrolledStudentsCurrentPage - 1) * STUDENTS_PER_PAGE;
    const endEnrolled = startEnrolled + STUDENTS_PER_PAGE;
    const paginatedEnrolledStudents = enrolledStudents.slice(startEnrolled, endEnrolled);

    renderStudentList(paginatedEnrolledStudents, 'enrolled-students', true);
    renderPagination('enrolled-students-pagination', enrolledStudentsCurrentPage, enrolledStudentsTotalPages, newPage => {
        enrolledStudentsCurrentPage = newPage;
        const start = (newPage - 1) * STUDENTS_PER_PAGE;
        const end = start + STUDENTS_PER_PAGE;
        renderStudentList(enrolledStudents.slice(start, end), 'enrolled-students', true);
        renderPagination('enrolled-students-pagination', newPage, enrolledStudentsTotalPages, arguments.callee);
    });

    const poloSelect = document.getElementById('polo-select');
    poloSelect.innerHTML = '<option value="all">Todos os polos</option>' + polos.map(polo => `
        <option value="${polo.id}">${polo.nome}</option>
    `).join('');
    poloSelect.value = poloSelecionado;
    poloSelect.onchange = (e) => {
        poloSelecionado = e.target.value;
    };

    flatpickr("#start-date", {
        dateFormat: "d/m/Y",
        defaultDate: periodoInicio,
        onChange: (selectedDates) => {
            periodoInicio = selectedDates[0];
        }
    });

    flatpickr("#end-date", {
        dateFormat: "d/m/Y",
        defaultDate: periodoFim,
        onChange: (selectedDates) => {
            periodoFim = selectedDates[0];
        }
    });

    lucide.createIcons();

    renderDistribuicaoCharts();
    filterAvailableStudents(1);
}

// Função para alternar abas
function showTab(tabId) {
    ['distribuicao', 'frequencia', 'movimentacao', 'taxa', 'ativas'].forEach(id => {
        const tab = document.getElementById(id + '-tab');
        const button = document.querySelector(`button[data-tab="${id}"]`);
        if (tab && button) {
            tab.classList.add('hidden');
            button.classList.remove('bg-blue-600', 'text-white');
            button.classList.add('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
        }
    });
    const activeTab = document.getElementById(tabId + '-tab');
    const activeButton = document.querySelector(`button[data-tab="${tabId}"]`);
    if (activeTab && activeButton) {
        activeTab.classList.remove('hidden');
        activeButton.classList.remove('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
        activeButton.classList.add('bg-blue-600', 'text-white', 'hover:bg-blue-700');

        if (tabId === 'frequencia') {
            renderFrequenciaChart();
        } else if (tabId === 'movimentacao') {
            renderMovimentacaoCharts();
        } else if (tabId === 'distribuicao') {
            renderDistribuicaoCharts();
        }
    }
}

const style = document.createElement('style');
style.innerHTML = `
    .class-type-tag {
        display: inline-block;
        padding: 1px 6px;
        border-radius: 9999px;
        font-size: 12px;
        font-weight: 500;
        color: #ffffff;
    }
    .class-type-tag.cognitiva {
        background-color: #86efac;
    }
    .class-type-tag.motora {
        background-color: #d8b4fe;
    }
`;
document.head.appendChild(style);

// Configurar event listeners para botões e cards
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        // Botões de abas
        const tabButtons = Array.from(document.querySelectorAll('button[data-tab]'));
        tabButtons.forEach((button, index) => {
            if (!button || !(button instanceof HTMLElement)) {
                return;
            }
            const tabId = button.getAttribute('data-tab');
            if (tabId) {
                button.addEventListener('click', () => showTab(tabId));
            }
        });

        // Cards de resumo
        const summaryCards = Array.from(document.querySelectorAll('div[data-tab]'));
        summaryCards.forEach((card, index) => {
            if (!card || !(card instanceof HTMLElement)) {
                return;
            }
            const tabId = card.getAttribute('data-tab');
            if (tabId) {
                card.addEventListener('click', () => showTab(tabId));
            }
        });

        showTab('distribuicao');
        const searchInput = document.getElementById('student-search-available');
        const debouncedSearch = debounce((value) => {
            filterAvailableStudents(1, value);
        }, 300);

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                debouncedSearch(e.target.value);
            });
        }

        fetchData();
    }, 500);
});