let students = [];
let classes = [];
let enrollments = [];
let selectedClass = null;

// Lista de unidades permitidas
const allowedUnits = [
    "C.M.E. JURANDIR DA SILVA MELO",
    "C.M.E. MENALDO CARLOS DE MAGALHÃES",
    "C.M. GUSTAVO CAMPOS DA SILVEIRA",
    "E.M. ANÍZIA ROSA DE OLIVEIRA COUTINHOGUSTAVO CAMPOS DA SILVEIRA",
    "E.M. BELINO CATHARINO DE SOUZA",
    "E.M. EDILÊNIO SILVA DE SOUZA",
    "E.M. EDILSON VIGNOLI MARINS",
    "E.M. ISMÊNIA DE BARROS BARROSO",
    "E.M. JARDIM IPITANGAS",
    "E.M. JOÃO LAUREANO DA SILVA",
    "E.M. JOÃO MACHADO DA CUNHA",
    "E.M. JOSÉ BANDEIRA",
    "E.M. LUCIANA SANTANA COUTINHO",
    "E.M. LÚCIO NUNES",
    "E.M. MANOEL MUNIZ DA SILVA",
    "E.M. MARGARIDA ROSA DE AMORIM",
    "E.M. MARIA LUIZA DE AMORIM MENDONÇA",
    "E.M. ORGÉ FERREIRA DOS SANTOS",
    "E.M. PREFEITO WALQUIDES DE SOUZA LIMA",
    "E.M. PROFESSOR FRANCISCO VIGNOLI",
    "E.M. PROFESSORA OSÍRIS PALMIER DA VEIGA",
    "E.M. RUBENS DE LIMA CAMPOS",
    "E.M. SEBASTIÃO MANOEL DOS REIS",
    "E.M. THEÓFILO D'ÁVILA",
    "E.M. VALTEMIR JOSÉ DA COSTA",
    "E.M. VILATUR",
    "E.M. BEATRIZ AMARAL",
    "E.M. ELCIRA DE OLIVEIRA COUTINHO",
    "E.M. PAULO LUIZ BARROSO OLIVEIRA",
    "E.M. PROFESSORA MARIA DE LOURDES MELO PAES BARRETO",
    "E.M. VEREADOR IVAN DA SILVA MELO",
    "C.M.E. PADRE MANUEL"
];

// Função de retentativa para requisições
const retryFetch = async (url, options, retries = 2, delay = 500) => {
    const cacheKey = `cache_${url}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        try {
            const { data, timestamp } = JSON.parse(cached);
            console.log('Dados do cache:', { url, turmas_length: data.turmas?.length || 0, alunos_length: data.alunos?.data?.length || 0 }); // Log para depuração
            if (Date.now() - timestamp < 10000 && 
                data && 
                Array.isArray(data.turmas) && data.turmas.length > 0 && 
                Array.isArray(data.alunos?.data) && data.alunos.data.length > 0) {
                return data;
            } else {
                console.warn('Cache inválido ou incompleto, limpando:', { url });
                localStorage.removeItem(cacheKey);
            }
        } catch (e) {
            console.warn('Erro ao processar cache do localStorage:', e.message);
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
        // Inicializar variáveis
        students = [];
        classes = [];
        enrollments = [];
        selectedClass = null;

        // Flag para controlar renderização
        let isRendered = false;

        // Tentar renderizar dados em cache
        const cacheKey = 'cache_/api/dashboard_data';
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                const { data, timestamp } = JSON.parse(cached);
                console.log('Dados do cache:', { 
                    turmas_length: data.turmas?.length || 0,
                    alunos_length: data.alunos?.data?.length || 0,
                    matriculas_length: data.matriculas?.length || 0
                }); // Log para depuração
                if (Date.now() - timestamp < 10000 && 
                    data && 
                    Array.isArray(data.turmas) && data.turmas.length > 0 && 
                    Array.isArray(data.alunos?.data) && data.alunos.data.length > 0) {
                    students = data.alunos.data;
                    classes = data.turmas;
                    enrollments = data.matriculas || [];
                    console.log('Cache válido usado:', {
                        classes_length: classes.length,
                        students_length: students.length,
                        enrollments_length: enrollments.length
                    }); // Log para depuração
                    isRendered = true;
                    filterClasses('cognitiva');
                } else {
                    console.warn('Cache inválido ou incompleto, limpando:', { cacheKey });
                    localStorage.removeItem(cacheKey);
                }
            } catch (e) {
                console.warn('Erro ao processar cache do localStorage:', e.message);
                localStorage.removeItem(cacheKey);
            }
        }

        // Buscar dados frescos
        const data = await retryFetch('/api/dashboard_data', { credentials: 'include' });
        console.log('Resposta fresca de /api/dashboard_data:', { 
            turmas_length: data.turmas?.length || 0,
            alunos_length: data.alunos?.data?.length || 0,
            matriculas_length: data.matriculas?.length || 0,
            turmas_sample: data.turmas?.slice(0, 2) || [],
            alunos_sample: data.alunos?.data?.slice(0, 2) || []
        }); // Log para depuração

        // Atualizar variáveis com dados frescos
        students = Array.isArray(data.alunos?.data) ? data.alunos.data : [];
        classes = Array.isArray(data.turmas) ? data.turmas : [];
        enrollments = Array.isArray(data.matriculas) ? data.matriculas : [];
        console.log('Dados frescos processados:', {
            classes_length: classes.length,
            students_length: students.length,
            enrollments_length: enrollments.length
        }); // Log para depuração

        // Renderizar com dados frescos
        if (!isRendered || classes.length > 0 || students.length > 0) {
            console.log('Renderizando com dados frescos');
            filterClasses('cognitiva');
        } else {
            console.log('Pulando renderização, dados já exibidos via cache');
        }
    } catch (error) {
        console.error('Erro em loadData:', error.message);
        showToast('Erro ao carregar dados: ' + error.message, 'error', 'alert-circle');
        // Renderizar com valores padrão
        filterClasses('cognitiva');
    }
}

async function refreshEnrollments() {
    try {
        const data = await retryFetch('/api/matriculas', { credentials: 'include' });
        console.log('Matrículas recarregadas:', data.length); // Log para depuração
        return Array.isArray(data) ? data : enrollments;
    } catch (error) {
        console.warn('Erro ao recarregar matrículas:', error.message);
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

function extractStudentGrade(studentEtapa) {
    if (!studentEtapa) {
        return null;
    }

    const numberMatch = studentEtapa.match(/^(\d+)/);
    if (numberMatch) {
        return parseInt(numberMatch[1], 10);
    }

    const textToNumber = {
        'primeiro': 1,
        'segundo': 2,
        'terceiro': 3,
        'quarto': 4,
        'quinto': 5,
        'sexto': 6,
        'sétimo': 7,
        'oitavo': 8,
        'nono': 9
    };

    const words = studentEtapa.toLowerCase().split(' ');
    for (const word of words) {
        if (textToNumber[word]) {
            return textToNumber[word];
        }
    }

    return null;
}

function extractAcceptedGrades(grades) {
    if (!grades) {
        return [];
    }

    let gradesString;
    if (Array.isArray(grades)) {
        gradesString = grades.join(',');
    } else if (typeof grades === 'string') {
        gradesString = grades;
    } else {
        return [];
    }

    gradesString = gradesString.replace(/\s*e\s*/g, ',').replace(/\s*-\s*/g, ',').replace(/\s+/g, ',');
    const gradeArray = gradesString.split(',').map(grade => {
        const num = parseInt(grade.trim(), 10);
        return isNaN(num) ? null : num;
    }).filter(num => num !== null);

    return gradeArray;
}

function arraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    const sortedArr1 = arr1.slice().sort();
    const sortedArr2 = arr2.slice().sort();
    return sortedArr1.every((value, index) => value === sortedArr2[index]);
}

function filterClasses(type) {
    const search = document.getElementById('class-search').value.toLowerCase();
    const typeFilter = type || (document.querySelector('button.bg-blue-600')?.innerText.toLowerCase() === 'cognitivas' ? 'cognitiva' : 'motora');
    const dayFilter = document.getElementById('day-filter').value;
    const periodFilter = document.getElementById('period-filter').value;
    const poloFilter = document.getElementById('polo-filter') ? document.getElementById('polo-filter').value : '';
    const gradeFilter = document.getElementById('grade-filter') ? document.getElementById('grade-filter').value : '';

    document.querySelectorAll('button').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
    });
    const filterButton = document.querySelector(`#filter-${typeFilter}`);
    if (filterButton) {
        filterButton.classList.remove('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
        filterButton.classList.add('bg-blue-600', 'text-white', 'hover:bg-blue-700');
    }

    const filteredClasses = classes.filter(cls => {
        const matchesSearch = cls.name.toLowerCase().includes(search);
        const matchesType = !typeFilter || cls.type === typeFilter;
        const matchesDay = !dayFilter || cls.day === dayFilter;
        const matchesPeriod = !periodFilter || cls.period === periodFilter;
        const matchesPolo = !poloFilter || (cls.polo_name && cls.polo_name === poloFilter);
        let matchesGrade = true;
        if (gradeFilter) {
            const selectedGrades = JSON.parse(gradeFilter).map(Number);
            const classGrades = extractAcceptedGrades(cls.grades);
            matchesGrade = arraysEqual(selectedGrades, classGrades);
        }
        return matchesSearch && matchesType && matchesDay && matchesPeriod && matchesPolo && matchesGrade;
    });

    const div = document.getElementById('class-list');
    div.innerHTML = filteredClasses.length === 0 ?
        '<div class="text-center py-4 text-gray-500">Nenhuma turma disponível</div>' :
        filteredClasses.map(cls => {
            const className = extractClassName(cls.name);
            const capitalizedName = capitalizeFirstLetter(className);
            const classType = cls.type === 'cognitiva' ? 'Cognitiva' : 'Motora';
            return `
                <div class="flex items-center justify-between p-4 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer" onclick="selectClass('${cls.id}')">
                    <div>
                        <p class="font-medium inline-flex items-center">
                            ${capitalizedName}
                            <span class="class-type-tag ${cls.type}">${classType}</span>
                        </p>
                        <div class="class-item-details">
                            <p>${formatSchedule(cls.day, cls.period)}</p>
                            <p>Faixa etária: ${formatGrades(cls.grades)}</p>
                            <p>Polo: ${cls.polo_name || 'Não especificado'}</p>
                        </div>
                    </div>
                    <div class="text-sm text-gray-500">${cls.enrollmentCount}/${cls.capacity}</div>
                </div>
            `;
        }).join('');
    lucide.createIcons();
}

function selectClass(classId) {
    selectedClass = classes.find(cls => cls.id === classId);
    document.getElementById('close-selected-class').classList.remove('hidden');
    document.getElementById('student-search-available').disabled = false;
    document.getElementById('student-unit-filter').disabled = false;
    document.getElementById('enrolled-students-wrapper').classList.remove('hidden');

    const classType = selectedClass.type === 'cognitiva' ? 'Cognitiva' : 'Motora';
    const className = extractClassName(selectedClass.name);
    const capitalizedName = capitalizeFirstLetter(className);
    document.getElementById('selected-class-title').innerHTML = `
        ${capitalizedName}
        <span class="class-type-tag ${selectedClass.type}">${classType}</span>
    `;
    updateSelectedClassDetails();
    filterAvailableStudents();
    renderEnrolledStudents();
    lucide.createIcons();
}

function deselectClass() {
    selectedClass = null;
    document.getElementById('close-selected-class').classList.add('hidden');
    document.getElementById('student-search-available').disabled = true;
    document.getElementById('student-unit-filter').disabled = true;
    document.getElementById('enrolled-students-wrapper').classList.add('hidden');
    document.getElementById('selected-class-title').textContent = 'Nenhuma turma selecionada';
    document.getElementById('selected-class-details').innerHTML = `
        <p>Selecione uma turma para visualizar os detalhes.</p>
    `;
    document.getElementById('available-students').innerHTML = `
        <div class="text-center py-4 text-gray-500">Nenhuma turma selecionada.</div>
    `;
    document.getElementById('enrolled-students').innerHTML = `
        <div class="text-center py-4 text-gray-500">Nenhuma turma selecionada.</div>
    `;
    const unitFilterSelect = document.getElementById('student-unit-filter');
    unitFilterSelect.innerHTML = '<option value="">Filtrar por unidade</option>';
    lucide.createIcons();
}

function filterAvailableStudents() {
    if (!selectedClass) {
        return;
    }
    const search = document.getElementById('student-search-available').value.toLowerCase();
    const unitFilter = document.getElementById('student-unit-filter').value;
    let acceptedGrades = extractAcceptedGrades(selectedClass.grades);
    const selectedClassName = extractClassName(selectedClass.name).toLowerCase();

    const potentialStudents = students.filter(student => {
        if (!(student.name.toLowerCase().includes(search) || student.id.includes(search))) {
            return false;
        }
        if (enrollments.some(e => e.studentId === student.id && e.classId === selectedClass.id)) {
            return false;
        }
        const studentGrade = extractStudentGrade(student.etapa);
        if (!(studentGrade !== null && acceptedGrades.includes(studentGrade))) {
            return false;
        }
        const normalizedStudentPolo = student.polo_name ? student.polo_name.trim().toLowerCase() : '';
        const normalizedClassPolo = selectedClass.polo_name ? selectedClass.polo_name.trim().toLowerCase() : '';
        if (normalizedStudentPolo !== normalizedClassPolo) {
            return false;
        }
        const studentEnrollments = enrollments.filter(e => e.studentId === student.id);
        const enrollmentsOnSameDay = studentEnrollments.filter(enrollment => {
            const enrolledClass = classes.find(cls => cls.id === enrollment.classId);
            return enrolledClass && enrolledClass.day === selectedClass.day;
        });
        if (enrollmentsOnSameDay.length >= 2) {
            return false;
        }
        const studentTurno = student.turno ? student.turno.toLowerCase() : null;
        const classPeriod = selectedClass.period ? selectedClass.period.toLowerCase() : null;
        const isContraturno = studentTurno && classPeriod && (
            (studentTurno === 'manha' && classPeriod === 'tarde') ||
            (studentTurno === 'tarde' && classPeriod === 'manha')
        );
        if (!isContraturno) {
            return false;
        }
        if (selectedClass.type === 'motora') {
            const cognitiveEnrollmentsSameDayAndPeriod = studentEnrollments.filter(enrollment => {
                const enrolledClass = classes.find(cls => cls.id === enrollment.classId);
                return enrolledClass &&
                       enrolledClass.type === 'cognitiva' &&
                       enrolledClass.day === selectedClass.day &&
                       enrolledClass.period.toLowerCase() === selectedClass.period.toLowerCase();
            });
            if (cognitiveEnrollmentsSameDayAndPeriod.length === 0) {
                return false;
            }
        }
        const hasSameClass = studentEnrollments.some(enrollment => {
            const enrolledClass = classes.find(cls => cls.id === enrollment.classId);
            if (!enrolledClass || !enrolledClass.name) return false;
            const enrolledClassName = extractClassName(enrolledClass.name).toLowerCase();
            return enrolledClassName === selectedClassName;
        });
        if (hasSameClass) {
            return false;
        }
        return true;
    });

    const unitFilterSelect = document.getElementById('student-unit-filter');
    const currentSelectedUnit = unitFilterSelect.value;
    const units = [...new Set(potentialStudents.map(student => student.unidade).filter(unit => unit && allowedUnits.includes(unit)))];
    units.sort();
    unitFilterSelect.innerHTML = '<option value="">Filtrar por unidade</option>' + 
        units.map(unit => `<option value="${unit}">${unit}</option>`).join('');

    if (currentSelectedUnit && units.includes(currentSelectedUnit)) {
        unitFilterSelect.value = currentSelectedUnit;
    }

    const availableStudents = unitFilter ?
        potentialStudents.filter(student => student.unidade === unitFilter) :
        potentialStudents;

    const div = document.getElementById('available-students');
    div.innerHTML = availableStudents.length === 0 ?
        '<div class="text-center py-4 text-gray-500">Nenhuma turma selecionada.</div>' :
        availableStudents.map(student => `
            <div class="flex items-center justify-between p-3 border rounded-md hover:bg-gray-50">
                <div>
                    <p class="font-medium">${student.name}</p>
                    <p class="text-sm text-gray-500">Unidade: ${student.unidade || 'Não especificado'}</p>
                    <p class="text-sm text-gray-500">${student.etapa}</p>
                </div>
                <button onclick="enrollStudent('${student.id}')" class="bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 flex items-center">
                    <i data-lucide="plus" class="h-4 w-4 mr-1"></i>
                    Matricular
                </button>
            </div>
        `).join('');
    lucide.createIcons();
}

function renderEnrolledStudents() {
    if (!selectedClass) {
        return;
    }

    const enrolledStudents = students.filter(student => {
        return enrollments.some(e => String(e.studentId) === String(student.id) && String(e.classId) === String(selectedClass.id));
    });

    const div = document.getElementById('enrolled-students');
    if (!div) {
        return;
    }

    div.innerHTML = enrolledStudents.length === 0 ?
        '<div class="text-center py-4 text-gray-500">Nenhum aluno matriculado nesta turma.</div>' :
        enrolledStudents.map(student => `
            <div class="flex items-center justify-between p-3 border rounded-md hover:bg-gray-50">
                <div>
                    <p class="font-medium">${student.name}</p>
                    <p class="text-sm text-gray-500">Unidade: ${student.unidade || 'Não especificado'}</p>
                    <p class="text-sm text-gray-500">${student.etapa}</p>
                </div>
                <button onclick="unenrollStudent('${student.id}')" class="bg-red-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 flex items-center">
                    <i data-lucide="trash-2" class="h-4 w-4 mr-1"></i>
                    Remover
                </button>
            </div>
        `).join('');

    lucide.createIcons();
}

async function enrollStudent(studentId) {
    try {
        const response = await retryFetch('/api/matriculas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ alunoId: studentId, turmaId: selectedClass.id }),
            credentials: 'include'
        });
        const newEnrollment = response;
        console.log('Nova matrícula criada:', newEnrollment); // Log para depuração

        const tempEnrollment = {
            id: newEnrollment.id,
            studentId: String(newEnrollment.studentId),
            classId: String(newEnrollment.classId),
            required: selectedClass.type === 'cognitiva'
        };
        enrollments.push(tempEnrollment);

        selectedClass.enrollmentCount += 1;

        renderEnrolledStudents();

        await delay(1000);
        const newEnrollments = await refreshEnrollments();

        const enrollmentExists = newEnrollments.some(e => e.id === newEnrollment.id);
        if (!enrollmentExists) {
            enrollments = [...newEnrollments, tempEnrollment];
        } else {
            enrollments = newEnrollments;
        }

        renderEnrolledStudents();
        filterAvailableStudents();
        filterClasses();
        updateSelectedClassDetails();
        showToast('Aluno matriculado com sucesso!', 'success', 'check-circle');
        lucide.createIcons();
    } catch (error) {
        console.error('Erro ao matricular aluno:', error.message);
        showToast('Erro: ' + error.message, 'error', 'alert-circle');
        lucide.createIcons();
    }
}

async function unenrollStudent(studentId) {
    try {
        const enrollment = enrollments.find(e => e.studentId === studentId && e.classId === selectedClass.id);
        if (!enrollment) throw new Error('Matrícula não encontrada');
        const response = await retryFetch(`/api/matriculas/${enrollment.id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        console.log('Matrícula removida:', enrollment.id); // Log para depuração
        await delay(1000);
        enrollments = await refreshEnrollments();
        selectedClass.enrollmentCount -= 1;
        renderEnrolledStudents();
        filterAvailableStudents();
        filterClasses();
        updateSelectedClassDetails();
        showToast('Aluno removido da turma com sucesso!', 'error', 'trash-2');
        lucide.createIcons();
    } catch (error) {
        console.error('Erro ao remover matrícula:', error.message);
        showToast('Erro: ' + error.message, 'error', 'alert-circle');
        lucide.createIcons();
    }
}

function updateSelectedClassDetails() {
    if (!selectedClass) return;
    const classType = selectedClass.type === 'cognitiva' ? 'Cognitiva' : 'Motora';
    const className = extractClassName(selectedClass.name);
    const capitalizedName = capitalizeFirstLetter(className);
    document.getElementById('selected-class-title').innerHTML = `
        ${capitalizedName}
        <span class="class-type-tag ${selectedClass.type}">${classType}</span>
    `;
    document.getElementById('selected-class-details').innerHTML = `
        <div class="detail-item">
            <i data-lucide="calendar"></i>
            <span>${formatSchedule(selectedClass.day, selectedClass.period, false)}</span>
        </div>
        <div class="detail-item">
            <i data-lucide="clock"></i>
            <span>${formatSchedule(selectedClass.day, selectedClass.period).split('(')[1].replace(')', '')}</span>
        </div>
        <div class="detail-item">
            <i data-lucide="graduation-cap"></i>
            <span>Faixa etária: ${formatGrades(selectedClass.grades)}</span>
        </div>
        <div class="detail-item">
            <i data-lucide="school"></i>
            <span>Polo: ${selectedClass.polo_name || 'Não especificado'}</span>
        </div>
        <div class="detail-item">
            <i data-lucide="users"></i>
            <span>Vagas: ${selectedClass.enrollmentCount}/${selectedClass.capacity}</span>
        </div>
    `;
    lucide.createIcons();
}

function showToast(message, type, icon) {
    const toastContainer = document.getElementById('custom-toast-container');
    if (!toastContainer) {
        console.warn('Contêiner de toast não encontrado');
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
    // Adicionar event listeners para os botões
    document.getElementById('filter-cognitiva').addEventListener('click', () => filterClasses('cognitiva'));
    document.getElementById('filter-motora').addEventListener('click', () => filterClasses('motora'));

    // Adicionar event listeners para o input de busca e os selects
    document.getElementById('class-search').addEventListener('input', () => filterClasses());
    document.getElementById('day-filter').addEventListener('change', () => filterClasses());
    document.getElementById('period-filter').addEventListener('change', () => filterClasses());
    const poloFilter = document.getElementById('polo-filter');
    const gradeFilter = document.getElementById('grade-filter');
    if (poloFilter) poloFilter.addEventListener('change', () => filterClasses());
    if (gradeFilter) gradeFilter.addEventListener('change', () => filterClasses());

    // Adicionar event listener para o botão de fechar
    document.getElementById('close-selected-class').addEventListener('click', deselectClass);

    // Adicionar event listeners para os inputs de busca e filtro por unidade de alunos disponíveis
    document.getElementById('student-search-available').addEventListener('input', filterAvailableStudents);
    document.getElementById('student-unit-filter').addEventListener('change', filterAvailableStudents);

    // Carregar dados
    loadData();
});

// Estilos para tags de tipo de turma
const style = document.createElement('style');
style.innerHTML = `
    .class-type-tag {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
        margin-left: 8px;
        color: white;
    }
    .class-type-tag.cognitiva {
        background-color: #86efac;
    }
    .class-type-tag.motora {
        background-color: #d8b4fe;
    }
    .class-item-details {
        margin-top: 4px;
        color: #4b5563;
        font-size: 14px;
    }
    .detail-item {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
    }
    .detail-item i {
        height: 16px;
        width: 16px;
        color: #3b82f6;
    }
    .separator {
        margin: 16px 0;
        border: none;
        border-top: 1px solid #e5e7eb;
    }
`;
document.head.appendChild(style);