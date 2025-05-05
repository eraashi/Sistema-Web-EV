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

// Função para determinar o turno atual no fuso horário de São Paulo
function getCurrentPeriod() {
    const now = new Date();
    const saoPauloTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const currentHour = saoPauloTime.getHours();
    const period = currentHour >= 6 && currentHour <= 12 ? 'manha' : 'tarde';
    console.log(`Turno atual: ${period} (Hora em São Paulo: ${currentHour})`);
    return period;
}

// Função para determinar o dia da semana atual no fuso horário de São Paulo
function getCurrentDay() {
    const now = new Date();
    const saoPauloTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const weekdayMap = {
        0: 'seg', // Segunda
        1: 'ter', // Terça
        2: 'qua', // Quarta
        3: 'qui', // Quinta
        4: 'sex'  // Sexta
    };
    const dayIndex = saoPauloTime.getDay();
    const day = weekdayMap[dayIndex - 1] || null; // Ajuste para considerar domingo (0) como não letivo
    console.log(`Dia atual: ${day} (Dia da semana em São Paulo: ${dayIndex}, Data: ${saoPauloTime.toISOString()})`);
    return day;
}

async function updateDashboard() {
    // Atualizar Total de Alunos (geral)
    document.getElementById('total-students').textContent = students.length;

    // Atualizar Total de Alunos do Polo Atual (para diretor, coordenador e monitor)
    if (currentUserRole === 'diretor' || currentUserRole === 'coordenador' || currentUserRole === 'monitor') {
        const poloStudentsCount = await fetchPoloStudentsCount();
        document.getElementById('polo-students').textContent = poloStudentsCount;
    }

    // Filtrar turmas ativas no turno e dia atuais
    const currentPeriod = getCurrentPeriod();
    const currentDay = getCurrentDay();
    let activeClasses = [];
    if (currentDay) { // Apenas filtrar se for um dia letivo
        activeClasses = classes.filter(cls => 
            cls.period === currentPeriod && cls.day === currentDay && cls.enrollmentCount > 0
        );
        console.log(`Turmas ativas filtradas (turno: ${currentPeriod}, dia: ${currentDay}):`, activeClasses);
    } else {
        console.log('Hoje não é um dia letivo (sábado ou domingo), nenhuma turma ativa será exibida.');
    }

    // Filtrar turmas com base no polo do usuário (exceto para admin e secretaria)
    if (currentUserRole !== 'admin' && currentUserRole !== 'secretaria') {
        activeClasses = activeClasses.filter(cls => cls.polo_name === userPoloId);
        console.log(`Turmas ativas filtradas pelo polo (${userPoloId}):`, activeClasses);
    }

    // Atualizar Turmas Ativas (resumo na Visão Geral)
    document.getElementById('total-classes').textContent = activeClasses.length;

    // Atualizar Capacidade Média (considerando apenas turmas ativas)
    const totalCapacity = activeClasses.reduce((sum, cls) => sum + cls.capacity, 0);
    const avgCapacity = activeClasses.length > 0 ? (totalCapacity / activeClasses.length).toFixed(1) : 0;
    document.getElementById('avg-capacity').textContent = `Capacidade média: ${avgCapacity} alunos`;

    // Atualizar Disciplinas Cognitivas e Motoras (totais gerais, não apenas ativas)
    const cognitiveClasses = classes.filter(cls => cls.type === 'cognitiva');
    const motorClasses = classes.filter(cls => cls.type === 'motora');
    document.getElementById('cognitive-classes').textContent = cognitiveClasses.length;
    document.getElementById('motor-classes').textContent = motorClasses.length;

    // Separar turmas cognitivas e motoras ativas
    const activeCognitiveClasses = activeClasses.filter(cls => cls.type === 'cognitiva');
    const activeMotorClasses = activeClasses.filter(cls => cls.type === 'motora');

    // Atualizar a seção "Turmas Ativas no Polo" / "Turmas Ativas" com decoração e capitalização
    const cognitiveOccupancy = activeCognitiveClasses.map(cls => 
        `<span class="underline decoration-green-600">${capitalizeFirstLetter(cls.name)}: ${cls.enrollmentCount}/${cls.capacity}</span>`
    ).join('<br>');
    const motorOccupancy = activeMotorClasses.map(cls => 
        `<span class="underline decoration-purple-600">${capitalizeFirstLetter(cls.name)}: ${cls.enrollmentCount}/${cls.capacity}</span>`
    ).join('<br>');
    document.getElementById('cognitive-occupancy').innerHTML = cognitiveOccupancy || 'Nenhuma disciplina cognitiva ativa';
    document.getElementById('motor-occupancy').innerHTML = motorOccupancy || 'Nenhuma disciplina motora ativa';
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