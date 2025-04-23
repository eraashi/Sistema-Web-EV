let students = [];
let classes = [];
let enrollments = [];

async function loadData() {
    try {
        const responses = await Promise.all([
            fetch('/api/alunos', { credentials: 'include' }),
            fetch('/api/turmas', { credentials: 'include' }),
            fetch('/api/matriculas', { credentials: 'include' })
        ]);

        responses.forEach((response, index) => {
            console.log(`Resposta da requisição ${['alunos', 'turmas', 'matriculas'][index]}: Status ${response.status}`);
            if (!response.ok) {
                console.log(`Erro na requisição ${['alunos', 'turmas', 'matriculas'][index]}: Status ${response.status}`);
            }
        });

        const failedResponse = responses.find(r => !r.ok);
        if (failedResponse) {
            const errorText = await failedResponse.text();
            throw new Error(`Erro na requisição: ${failedResponse.url} retornou status ${failedResponse.status}. Detalhes: ${errorText}`);
        }

        const [alunosData, classesData, enrollmentsData] = await Promise.all(responses.map(r => r.json()));

        students = Array.isArray(alunosData.data) ? alunosData.data : [];
        classes = Array.isArray(classesData) ? classesData : [];
        enrollments = Array.isArray(enrollmentsData) ? enrollmentsData : [];

        updateDashboard();
    } catch (error) {
        console.log('Erro em loadData:', error.message);
        showToast('Erro: ' + error.message, 'error', 'alert-circle');
        // Comentar o redirecionamento para depurar
        // window.location.href = '/login';
    }
}

async function fetchPoloStudentsCount() {
    try {
        const response = await fetch('/api/alunos/polo_count', { credentials: 'include' });
        if (!response.ok) {
            const errorText = await response.text();
            console.log(`Erro ao buscar contagem de alunos do polo: Status ${response.status}, Detalhes: ${errorText}`);
            throw new Error(`Erro ao buscar contagem de alunos do polo: ${errorText}`);
        }
        const data = await response.json();
        console.log('Contagem de alunos do polo retornada:', data);
        return data.total_alunos_polo || 0;
    } catch (error) {
        console.log('Erro ao buscar contagem de alunos do polo:', error.message);
        showToast('Erro ao carregar contagem de alunos do polo: ' + error.message, 'error', 'alert-circle');
        return 0;
    }
}

async function updateDashboard() {
    // Atualizar Total de Alunos (geral)
    document.getElementById('total-students').textContent = students.length;

    // Atualizar Total de Alunos do Polo Atual (para diretor, coordenador e monitor)
    if (currentUserRole === 'diretor' || currentUserRole === 'coordenador' || currentUserRole === 'monitor') {
        const poloStudentsCount = await fetchPoloStudentsCount();
        document.getElementById('polo-students').textContent = poloStudentsCount;
    }

    // Atualizar Turmas Ativas e Capacidade Média
    document.getElementById('total-classes').textContent = classes.length;
    const totalCapacity = classes.reduce((sum, cls) => sum + cls.capacity, 0);
    const avgCapacity = classes.length > 0 ? (totalCapacity / classes.length).toFixed(1) : 0;
    document.getElementById('avg-capacity').textContent = `Capacidade média: ${avgCapacity} alunos`;

    // Atualizar Disciplinas Cognitivas e Motoras
    const cognitiveClasses = classes.filter(cls => cls.type === 'cognitiva');
    const motorClasses = classes.filter(cls => cls.type === 'motora');
    document.getElementById('cognitive-classes').textContent = cognitiveClasses.length;
    document.getElementById('motor-classes').textContent = motorClasses.length;

    // Atualizar Ocupação das Turmas
    const cognitiveOccupancy = cognitiveClasses.map(cls => `${cls.name}: ${cls.enrollmentCount}/${cls.capacity}`).join('<br>');
    const motorOccupancy = motorClasses.map(cls => `${cls.name}: ${cls.enrollmentCount}/${cls.capacity}`).join('<br>');
    document.getElementById('cognitive-occupancy').innerHTML = cognitiveOccupancy || 'Nenhuma disciplina cognitiva cadastrada';
    document.getElementById('motor-occupancy').innerHTML = motorOccupancy || 'Nenhuma disciplina motora cadastrada';
}

async function refreshEnrollments() {
    try {
        const response = await fetch('/api/matriculas', { credentials: 'include' });
        if (!response.ok) {
            const errorText = await response.text();
            console.log(`Erro ao recarregar matrículas: Status ${response.status}, Detalhes: ${errorText}`);
            throw new Error(`Erro ao recarregar matrículas: ${errorText}`);
        }
        return await response.json();
    } catch (error) {
        console.log('Erro ao recarregar matrículas:', error.message);
        return enrollments;
    }
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

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
    if (!grades) {
        return 'Não especificado';
    }

    let gradesString;
    if (Array.isArray(grades)) {
        gradesString = grades.join(',');
    } else if (typeof grades === 'string') {
        gradesString = grades;
    } else {
        return 'Não especificado';
    }

    try {
        return gradesString.split(',').map(g => `${g.trim()}º`).join(' e ');
    } catch (error) {
        return 'Não especificado';
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

document.addEventListener('DOMContentLoaded', () => {
    loadData();
});