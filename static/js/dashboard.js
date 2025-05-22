let students = [];
let classes = [];
let enrollments = [];
let activeClassesWithStudents = [];

const retryFetch = async (url, options, retries = 2, delay = 500) => {
    // Incluir userPoloId na chave de cache
    const cacheKey = `cache_${url}:${userPoloId || 'no_polo'}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 300000) { // 5 minutos TTL (300.000 ms)
            console.log(`Cache local encontrado para ${cacheKey}:`, data);
            return data;
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
                console.log(`Dados salvos no cache local para ${cacheKey}:`, data);
            } catch (e) {
                console.warn('Erro ao salvar no localStorage:', e.message);
            }
            return data;
        } catch (error) {
            if (i < retries - 1) {
                console.warn(`Tentativa ${i + 1} falhou para ${url}: ${error}. Tentando novamente em ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.error(`Falhou após ${retries} tentativas para ${url}: ${error}`);
                throw error;
            }
        }
    }
};

async function loadData() {
    try {
        // Inicializar variáveis para evitar valores zerados
        students = [];
        classes = [];
        enrollments = [];
        activeClassesWithStudents = [];

        // Flag para controlar renderização
        let isRendered = false;

        // Obter turno e dia atuais para validação do cache
        const currentPeriod = getCurrentPeriod();
        const currentDay = getCurrentDay();

        // 1. Verificar primeiro os dados pré-carregados no sessionStorage
        const preCacheKey = `precache:/api/dashboard_data:${userPoloId || 'no_polo'}`;
        const preCached = sessionStorage.getItem(preCacheKey);
        if (preCached) {
            try {
                const { data, timestamp, period: cachedPeriod, day: cachedDay } = JSON.parse(preCached);
                console.log('Dados pré-carregados encontrados:', {
                    turmas_length: data.turmas?.length || 0,
                    alunos_length: data.alunos?.data?.length || 0,
                    turmas_ativas_length: data.turmas_ativas?.turmas?.length || 0,
                    polo_count: data.polo_count?.total_alunos_polo || 0,
                    cachedPeriod,
                    cachedDay
                });

                // Validar se os dados pré-carregados são completos e correspondem ao turno/dia atual
                if (data && 
                    Array.isArray(data.turmas) && data.turmas.length > 0 && 
                    Array.isArray(data.alunos?.data) && data.alunos.data.length > 0 && 
                    Array.isArray(data.turmas_ativas?.turmas) && 
                    data.polo_count && typeof data.polo_count.total_alunos_polo === 'number' &&
                    cachedPeriod === currentPeriod && cachedDay === currentDay) {
                    students = data.alunos.data;
                    classes = data.turmas;
                    enrollments = data.matriculas || [];
                    activeClassesWithStudents = data.turmas_ativas.turmas || [];
                    console.log('Pré-cache válido usado:', {
                        classes_length: classes.length,
                        students_length: students.length,
                        activeClasses_length: activeClassesWithStudents.length,
                        polo_count: data.polo_count.total_alunos_polo
                    });

                    isRendered = true;
                    // Atualizar total-students com base no cargo
                    if (currentUserRole === 'admin' || currentUserRole === 'secretaria') {
                        console.log(`Exibindo total de alunos para admin/secretaria: ${students.length}`);
                        document.getElementById('total-students').textContent = students.length;
                    } else {
                        console.log(`Exibindo total de alunos para polo ${userPoloId}: ${data.polo_count.total_alunos_polo}`);
                        document.getElementById('total-students').textContent = data.polo_count.total_alunos_polo;
                    }
                    updateDashboard();

                    // Limpar o pré-cache após uso
                    sessionStorage.removeItem(preCacheKey);
                    return; // Não precisamos buscar dados frescos
                } else {
                    console.warn('Pré-cache inválido, incompleto ou turno/dia não correspondem:', {
                        turmas_valid: Array.isArray(data.turmas) && data.turmas.length > 0,
                        alunos_valid: Array.isArray(data.alunos?.data) && data.alunos.data.length > 0,
                        turmas_ativas_valid: Array.isArray(data.turmas_ativas?.turmas),
                        polo_count_valid: data.polo_count && typeof data.polo_count.total_alunos_polo === 'number',
                        period_match: cachedPeriod === currentPeriod,
                        day_match: cachedDay === currentDay
                    });
                    sessionStorage.removeItem(preCacheKey); // Limpar pré-cache corrompido
                }
            } catch (e) {
                console.warn('Erro ao processar pré-cache do sessionStorage:', e.message);
                sessionStorage.removeItem(preCacheKey); // Limpar pré-cache corrompido
            }
        } else {
            console.log('Nenhum dado pré-carregado encontrado no sessionStorage');
        }

        // 2. Se não houver pré-cache válido, verificar o cache do localStorage
        const cacheKey = `cache_/api/dashboard_data:${userPoloId || 'no_polo'}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                const { data, timestamp, period: cachedPeriod, day: cachedDay } = JSON.parse(cached);
                console.log('Dados do cache local:', { 
                    turmas_length: data.turmas?.length || 0,
                    alunos_length: data.alunos?.data?.length || 0,
                    turmas_ativas_length: data.turmas_ativas?.turmas?.length || 0,
                    polo_count: data.polo_count?.total_alunos_polo || 0,
                    cachedPeriod,
                    cachedDay
                });

                if (Date.now() - timestamp < 300000 && 
                    data && 
                    Array.isArray(data.turmas) && data.turmas.length > 0 && 
                    Array.isArray(data.alunos?.data) && data.alunos.data.length > 0 &&
                    cachedPeriod === currentPeriod && cachedDay === currentDay) {
                    students = data.alunos.data;
                    classes = data.turmas;
                    enrollments = data.matriculas || [];
                    activeClassesWithStudents = data.turmas_ativas?.turmas || [];
                    console.log('Cache local válido usado:', {
                        classes_length: classes.length,
                        students_length: students.length,
                        activeClasses_length: activeClassesWithStudents.length,
                        polo_count: data.polo_count.total_alunos_polo
                    });

                    isRendered = true;
                    // Atualizar total-students com base no cargo
                    if (currentUserRole === 'admin' || currentUserRole === 'secretaria') {
                        console.log(`Exibindo total de alunos para admin/secretaria: ${students.length}`);
                        document.getElementById('total-students').textContent = students.length;
                    } else {
                        console.log(`Exibindo total de alunos para polo ${userPoloId}: ${data.polo_count.total_alunos_polo}`);
                        document.getElementById('total-students').textContent = data.polo_count.total_alunos_polo;
                    }
                    updateDashboard();
                } else {
                    console.warn('Cache local inválido, incompleto ou turno/dia não correspondem:', {
                        turmas_valid: Array.isArray(data.turmas) && data.turmas.length > 0,
                        alunos_valid: Array.isArray(data.alunos?.data) && data.alunos.data.length > 0,
                        period_match: cachedPeriod === currentPeriod,
                        day_match: cachedDay === currentDay
                    });
                    localStorage.removeItem(cacheKey); // Limpar cache corrompido
                }
            } catch (e) {
                console.warn('Erro ao processar cache do localStorage:', e.message);
                localStorage.removeItem(cacheKey); // Limpar cache corrompido
            }
        }

        // 3. Buscar dados frescos se não houver cache válido
        console.log('Buscando dados frescos de /api/dashboard_data');
        const data = await retryFetch('/api/dashboard_data', { credentials: 'include' });
        console.log('Resposta fresca de /api/dashboard_data:', { 
            turmas_length: data.turmas?.length || 0,
            alunos_length: data.alunos?.data?.length || 0,
            turmas_ativas_length: data.turmas_ativas?.turmas?.length || 0,
            polo_count: data.polo_count?.total_alunos_polo || 0
        });

        // Atualizar variáveis com dados frescos
        students = Array.isArray(data.alunos?.data) ? data.alunos.data : [];
        classes = Array.isArray(data.turmas) ? data.turmas : [];
        enrollments = Array.isArray(data.matriculas) ? data.matriculas : [];
        activeClassesWithStudents = Array.isArray(data.turmas_ativas?.turmas) ? data.turmas_ativas.turmas : [];
        console.log('Dados frescos processados:', {
            classes_length: classes.length,
            students_length: students.length,
            activeClasses_length: activeClassesWithStudents.length,
            polo_count: data.polo_count.total_alunos_polo
        });

        // Salvar no cache com informações de turno e dia
        try {
            localStorage.setItem(cacheKey, JSON.stringify({ 
                data, 
                timestamp: Date.now(), 
                period: currentPeriod, 
                day: currentDay 
            }));
        } catch (e) {
            console.warn('Erro ao salvar no localStorage:', e.message);
        }

        // Atualizar total-students com base no cargo
        if (currentUserRole === 'admin' || currentUserRole === 'secretaria') {
            console.log(`Exibindo total de alunos para admin/secretaria: ${students.length}`);
            document.getElementById('total-students').textContent = students.length;
        } else {
            console.log(`Exibindo total de alunos para polo ${userPoloId}: ${data.polo_count.total_alunos_polo}`);
            document.getElementById('total-students').textContent = data.polo_count.total_alunos_polo;
        }

        // Renderizar apenas se necessário (evitar sobrescrita com cache)
        if (!isRendered || classes.length > 0 || students.length > 0) {
            console.log('Renderizando com dados frescos');
            updateDashboard();
        } else {
            console.log('Pulando renderização, dados já exibidos via cache');
        }
    } catch (error) {
        console.error('Erro em loadData:', error.message);
        showToast('Erro ao carregar dados: ' + error.message, 'error', 'alert-circle');
        // Renderizar com valores padrão
        document.getElementById('total-students').textContent = students.length;
        updateDashboard();
    }
}

function getCurrentPeriod() {
    const now = new Date();
    const saoPauloTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const currentHour = saoPauloTime.getHours();
    const period = currentHour >= 6 && currentHour <= 12 ? 'manha' : 'tarde';
    console.log(`Turno atual: ${period} (Hora em São Paulo: ${currentHour})`);
    return period;
}

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
    const day = weekdayMap[dayIndex - 1] || null;
    console.log(`Dia atual: ${day} (Dia da semana em São Paulo: ${dayIndex}, Data: ${saoPauloTime.toISOString()})`);
    return day;
}

function showPopover(event, cls, studentsList) {
    const existingPopover = document.querySelector('.custom-popover');
    if (existingPopover) {
        existingPopover.remove();
    }

    const popover = document.createElement('div');
    popover.className = 'custom-popover fixed bg-white border border-gray-300 rounded-lg shadow-lg p-4 z-50 min-w-max';
    const studentsHtml = studentsList.length > 0 
        ? studentsList.map(student => `<p class="text-gray-600">${student.name}</p>`).join('')
        : '<p class="text-gray-500">Nenhum aluno matriculado</p>';
    popover.innerHTML = `
        <h4 class="text-sm font-semibold text-gray-700 mb-2">${capitalizeFirstLetter(cls.name)}</h4>
        ${studentsHtml}
    `;

    const mouseX = event.clientX;
    const mouseY = event.clientY;
    popover.style.left = `${mouseX + 10}px`;
    popover.style.top = `${mouseY + 10}px`;

    document.body.appendChild(popover);

    const rect = popover.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        popover.style.left = `${window.innerWidth - rect.width - 10}px`;
    }
    if (rect.bottom > window.innerHeight) {
        popover.style.top = `${mouseY - rect.height - 10}px`;
    }
}

async function updateDashboard() {
    console.log('Atualizando dashboard:', {
        classes_length: classes.length,
        students_length: students.length,
        activeClasses_length: activeClassesWithStudents.length
    });

    document.getElementById('total-classes').textContent = activeClassesWithStudents.length;

    const totalCapacity = activeClassesWithStudents.reduce((sum, cls) => sum + cls.capacity, 0);
    const avgCapacity = activeClassesWithStudents.length > 0 ? (totalCapacity / activeClassesWithStudents.length).toFixed(1) : 0;
    document.getElementById('avg-capacity').textContent = `Capacidade média: ${avgCapacity} alunos`;

    const cognitiveClasses = classes.filter(cls => cls.type?.toLowerCase() === 'cognitiva');
    const motorClasses = classes.filter(cls => cls.type?.toLowerCase() === 'motora');
    document.getElementById('cognitive-classes').textContent = cognitiveClasses.length;
    document.getElementById('motor-classes').textContent = motorClasses.length;
    console.log('Disciplinas processadas:', {
        cognitivas: cognitiveClasses.length,
        motoras: motorClasses.length,
        tipos_encontrados: [...new Set(classes.map(cls => cls.type))],
        classes_sample: classes.slice(0, 2)
    });

    const activeCognitiveClasses = activeClassesWithStudents.filter(cls => cls.type?.toLowerCase() === 'cognitiva');
    const activeMotorClasses = activeClassesWithStudents.filter(cls => cls.type?.toLowerCase() === 'motora');

    const cognitiveOccupancy = activeCognitiveClasses.map(cls => `
        <span id="cognitive-turma-${cls.id}" class="underline decoration-green-600 cursor-pointer">
            ${capitalizeFirstLetter(cls.name)} (${cls.polo_name}): ${cls.enrollmentCount}/${cls.capacity}
        </span>`).join('<br>');

    const motorOccupancy = activeMotorClasses.map(cls => `
        <span id="motor-turma-${cls.id}" class="underline decoration-purple-600 cursor-pointer">
            ${capitalizeFirstLetter(cls.name)} (${cls.polo_name}): ${cls.enrollmentCount}/${cls.capacity}
        </span>`).join('<br>');

    document.getElementById('cognitive-occupancy').innerHTML = cognitiveOccupancy || 'Nenhuma disciplina cognitiva ativa';
    document.getElementById('motor-occupancy').innerHTML = motorOccupancy || 'Nenhuma disciplina motora ativa';

    activeCognitiveClasses.forEach(cls => {
        const element = document.getElementById(`cognitive-turma-${cls.id}`);
        if (element) {
            element.addEventListener('mouseover', (event) => showPopover(event, cls, cls.students));
            element.addEventListener('mouseout', () => {
                const popover = document.querySelector('.custom-popover');
                if (popover) popover.remove();
            });
        }
    });

    activeMotorClasses.forEach(cls => {
        const element = document.getElementById(`motor-turma-${cls.id}`);
        if (element) {
            element.addEventListener('mouseover', (event) => showPopover(event, cls, cls.students));
            element.addEventListener('mouseout', () => {
                const popover = document.querySelector('.custom-popover');
                if (popover) popover.remove();
            });
        }
    });
}

async function refreshEnrollments() {
    try {
        const data = await retryFetch('/api/matriculas', { credentials: 'include' });
        console.log('Matrículas recarregadas:', data);
        return data;
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
    // Limpar caches antigos para evitar valores incorretos
    const oldPreCacheKey = 'precache:/api/dashboard_data';
    const oldCacheKey = 'cache_/api/dashboard_data';
    sessionStorage.removeItem(oldPreCacheKey);
    localStorage.removeItem(oldCacheKey);
    console.log('Caches antigos limpos:', oldPreCacheKey, oldCacheKey);

    loadData();
});