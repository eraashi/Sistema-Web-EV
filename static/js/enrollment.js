let students = [];
let classes = [];
let enrollments = [];
let selectedClass = null;
let currentFilterType = 'cognitiva'; // Novo: variável para rastrear o filtro atual

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

// Função para alternar o estado dos botões
function toggleButtonsState(disable, clickedButton = null) {
    const enrollButtons = document.querySelectorAll('#available-students button');
    const unenrollButtons = document.querySelectorAll('#enrolled-students button');
    const allButtons = [...enrollButtons, ...unenrollButtons];

    allButtons.forEach(button => {
        button.disabled = disable;
        if (button === clickedButton && disable) {
            const icon = button.querySelector('[data-lucide]');
            if (icon) {
                console.log('Antes de aplicar loader:', icon.outerHTML);
                icon.setAttribute('data-lucide', 'loader');
                icon.classList.add('animate-spin');
                console.log('Após aplicar loader:', icon.outerHTML);
                // Forçar renderização do ícone com pequeno atraso
                setTimeout(() => {
                    lucide.createIcons();
                    console.log('Ícone loader renderizado no botão:', button, icon.outerHTML);
                }, 50);
            } else {
                console.warn('Ícone não encontrado no botão:', button);
            }
        } else if (button === clickedButton && !disable) {
            const icon = button.querySelector('[data-lucide]');
            if (icon) {
                console.log('Antes de restaurar ícone:', icon.outerHTML);
                icon.classList.remove('animate-spin');
                icon.setAttribute('data-lucide', button.classList.contains('bg-blue-600') ? 'plus' : 'trash-2');
                console.log('Após restaurar ícone:', icon.outerHTML);
                // Forçar renderização do ícone com pequeno atraso
                setTimeout(() => {
                    lucide.createIcons();
                    console.log('Ícone original restaurado no botão:', button, icon.outerHTML);
                }, 50);
            } else {
                console.warn('Ícone não encontrado no botão ao restaurar:', button);
            }
        }
    });
}

// Função para invalidar caches relevantes
function invalidateCaches() {
    // Limpar caches específicos
    const matriculasCacheKey = 'cache_/api/matriculas';
    const dashboardCacheKey = 'cache_/api/dashboard_data?apply_unit_filter=false';
    localStorage.removeItem(matriculasCacheKey);
    localStorage.removeItem(dashboardCacheKey);

    // Limpar todas as variações do cache de /api/dashboard_data no localStorage
    const localStorageKeys = Object.keys(localStorage);
    localStorageKeys.forEach(key => {
        if (key.startsWith('cache_/api/dashboard_data')) {
            localStorage.removeItem(key);
            console.log(`Cache local removido: ${key}`);
        }
    });

    // Limpar todas as variações do pré-cache de /api/dashboard_data no sessionStorage
    const sessionStorageKeys = Object.keys(sessionStorage);
    sessionStorageKeys.forEach(key => {
        if (key.startsWith('precache:/api/dashboard_data')) {
            sessionStorage.removeItem(key);
            console.log(`Pré-cache removido: ${key}`);
        }
    });

    console.log('Caches invalidados:', { matriculasCacheKey, dashboardCacheKey });
}

// Função de retentativa para requisições
const retryFetch = async (url, options, retries = 2, delay = 500) => {
    const cacheKey = `cache_${url}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        try {
            const { data, timestamp } = JSON.parse(cached);
            console.log('Dados do cache local:', { 
                url, 
                turmas_length: data.turmas?.length || 0, 
                alunos_length: data.alunos?.data?.length || 0,
                matriculas_length: data.matriculas?.length || 0 
            });
            // TTL de 5 minutos (300000 ms)
            if (Date.now() - timestamp < 300000 && 
                data && 
                Array.isArray(data.turmas) && data.turmas.length > 0 && 
                Array.isArray(data.alunos?.data) && data.alunos.data.length > 0) {
                console.log('Cache local válido usado:', { 
                    url, 
                    turmas_length: data.turmas?.length || 0, 
                    alunos_length: data.alunos?.data?.length || 0,
                    matriculas_length: data.matriculas?.length || 0 
                });
                return data;
            } else {
                console.warn('Cache local inválido ou expirado, removendo:', {
                    url,
                    timestamp_valid: Date.now() - timestamp < 300000,
                    turmas_valid: Array.isArray(data.turmas) && data.turmas.length > 0,
                    alunos_valid: Array.isArray(data.alunos?.data) && data.alunos.data.length > 0
                });
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
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            try {
                localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
                console.log('Dados armazenados no cache local:', { 
                    url, 
                    turmas_length: data.turmas?.length || 0, 
                    alunos_length: data.alunos?.data?.length || 0,
                    matriculas_length: Array.isArray(data) ? data.length : (data.matriculas?.length || 0) 
                });
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
        students = [];
        classes = [];
        enrollments = [];
        const previousClassId = selectedClass ? selectedClass.id : null;
        const previousFilterType = currentFilterType; // Novo: salvar o filtro atual

        let isRendered = false;

        const cacheKey = 'cache_/api/dashboard_data?apply_unit_filter=false';
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                const { data, timestamp } = JSON.parse(cached);
                console.log('Dados do cache local (dashboard_data):', { 
                    turmas_length: data.turmas?.length || 0,
                    alunos_length: data.alunos?.data?.length || 0,
                    matriculas_length: data.matriculas?.length || 0
                });
                if (Date.now() - timestamp < 300000 && 
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
                    });
                    isRendered = true;
                    filterClasses(previousFilterType); // Novo: usar o filtro salvo
                } else {
                    console.warn('Cache de dashboard_data inválido ou expirado, removendo:', {
                        timestamp_valid: Date.now() - timestamp < 300000,
                        turmas_valid: Array.isArray(data.turmas) && data.turmas.length > 0,
                        alunos_valid: Array.isArray(data.alunos?.data) && data.alunos.data.length > 0
                    });
                    localStorage.removeItem(cacheKey);
                }
            } catch (e) {
                console.warn('Erro ao processar cache de dashboard_data:', e.message);
                localStorage.removeItem(cacheKey);
            }
        }

        const data = await retryFetch('/api/dashboard_data?apply_unit_filter=false', { credentials: 'include' });
        console.log('Resposta fresca de /api/dashboard_data:', { 
            turmas_length: data.turmas?.length || 0,
            alunos_length: data.alunos?.data?.length || 0,
            matriculas_length: data.matriculas?.length || 0,
            turmas_sample: data.turmas?.slice(0, 2) || [],
            alunos_sample: data.alunos?.data?.slice(0, 2) || []
        });

        students = Array.isArray(data.alunos?.data) ? data.alunos.data : [];
        classes = Array.isArray(data.turmas) ? data.turmas : [];
        enrollments = Array.isArray(data.matriculas) ? data.matriculas : [];
        console.log('Dados frescos processados:', {
            classes_length: classes.length,
            students_length: students.length,
            enrollments_length: enrollments.length
        });

        if (!isRendered || classes.length > 0 || students.length > 0) {
            console.log('Renderizando com dados frescos');
            filterClasses(previousFilterType); // Novo: usar o filtro salvo
        } else {
            console.log('Pulando renderização, dados já exibidos via cache');
        }

        // Restaurar a seleção da turma atual, se aplicável
        if (previousClassId) {
            selectClass(previousClassId);
        }
    } catch (error) {
        console.error('Erro em loadData:', error.message);
        showToast('Erro ao carregar dados: ' + error.message, 'error', 'alert-circle');
        filterClasses(currentFilterType); // Novo: usar o filtro atual em caso de erro
    }
}

async function refreshEnrollments() {
    try {
        const data = await retryFetch('/api/matriculas', { credentials: 'include' });
        console.log('Matrículas recarregadas:', { matriculas_length: data.length });
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

// Função para verificar se o texto quebrou em várias linhas e aplicar a classe
function checkLineBreaks(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn(`Contêiner ${containerId} não encontrado`);
        return;
    }

    const nameElements = container.querySelectorAll('.font-medium');
    console.log(`Verificando quebras de linha em ${containerId}, encontrados ${nameElements.length} elementos com .font-medium`);

    nameElements.forEach((element, index) => {
        // Obter a altura total do elemento
        const elementHeight = element.offsetHeight;
        // Obter a altura de uma linha (usando line-height)
        const lineHeight = parseFloat(window.getComputedStyle(element).lineHeight);
        // Obter a largura do elemento
        const elementWidth = element.offsetWidth;
        // Verificar se há ícone presente
        const hasIcon = element.querySelector('.pcd-icon') !== null;

        // Se a altura do elemento for maior que a altura de uma linha, o texto quebrou
        if (elementHeight > lineHeight) {
            element.classList.add('has-line-break');
            console.log(`Quebra de linha detectada para elemento ${index} (${containerId}): Nome: "${element.textContent.trim()}", altura: ${elementHeight}px, line-height: ${lineHeight}px, largura: ${elementWidth}px, tem ícone: ${hasIcon}`);
        } else {
            element.classList.remove('has-line-break');
            console.log(`Sem quebra de linha para elemento ${index} (${containerId}): Nome: "${element.textContent.trim()}", altura: ${elementHeight}px, line-height: ${lineHeight}px, largura: ${elementWidth}px, tem ícone: ${hasIcon}`);
        }
    });
}

function filterClasses(type) {
    currentFilterType = type || currentFilterType; // Novo: atualizar o filtro atual

    const search = document.getElementById('class-search')?.value.toLowerCase() || '';
    const typeFilter = currentFilterType; // Novo: usar o filtro atual
    const dayFilter = document.getElementById('day-filter')?.value || '';
    const periodFilter = document.getElementById('period-filter')?.value || '';
    const poloFilter = document.getElementById('polo-filter')?.value || '';
    const gradeFilter = document.getElementById('grade-filter')?.value || '';

    document.querySelectorAll('button').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('bg-gray-200', 'text-gray-700');
    });
    const filterButton = document.querySelector(`#filter-${typeFilter}`);
    if (filterButton) {
        filterButton.classList.remove('bg-gray-200', 'text-gray-700');
        filterButton.classList.add('bg-blue-600', 'text-white');
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
    if (div) {
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
}

function selectClass(classId) {
    selectedClass = classes.find(cls => cls.id === classId);
    const closeButton = document.getElementById('close-selected-class');
    const searchInput = document.getElementById('student-search-available');
    const unitFilter = document.getElementById('student-unit-filter');
    const enrolledWrapper = document.getElementById('enrolled-students-wrapper');
    const title = document.getElementById('selected-class-title');

    if (closeButton) closeButton.classList.remove('hidden');
    if (searchInput) searchInput.disabled = false;
    if (unitFilter) unitFilter.disabled = false;
    if (enrolledWrapper) enrolledWrapper.classList.remove('hidden');

    if (title && selectedClass) {
        const classType = selectedClass.type === 'cognitiva' ? 'Cognitiva' : 'Motora';
        const className = extractClassName(selectedClass.name);
        const capitalizedName = capitalizeFirstLetter(className);
        title.innerHTML = `
            ${capitalizedName}
            <span class="class-type-tag ${selectedClass.type}">${classType}</span>
        `;
    }

    updateSelectedClassDetails();
    filterAvailableStudents();
    renderEnrolledStudents();
    lucide.createIcons();
}

function deselectClass() {
    selectedClass = null;
    const closeButton = document.getElementById('close-selected-class');
    const searchInput = document.getElementById('student-search-available');
    const unitFilter = document.getElementById('student-unit-filter');
    const enrolledWrapper = document.getElementById('enrolled-students-wrapper');
    const title = document.getElementById('selected-class-title');
    const details = document.getElementById('selected-class-details');
    const availableStudents = document.getElementById('available-students');
    const enrolledStudents = document.getElementById('enrolled-students');
    const unitFilterSelect = document.getElementById('student-unit-filter');

    if (closeButton) closeButton.classList.add('hidden');
    if (searchInput) searchInput.disabled = true;
    if (unitFilter) unitFilter.disabled = true;
    if (enrolledWrapper) enrolledWrapper.classList.add('hidden');
    if (title) title.textContent = 'Nenhuma turma selecionada';
    if (details) details.innerHTML = '<p>Selecione uma turma para visualizar os detalhes.</p>';
    if (availableStudents) availableStudents.innerHTML = '<div class="text-center py-4 text-gray-500">Nenhuma turma selecionada.</div>';
    if (enrolledStudents) enrolledStudents.innerHTML = '<div class="text-center py-4 text-gray-500">Nenhuma turma selecionada.</div>';
    if (unitFilterSelect) unitFilterSelect.innerHTML = '<option value="">Filtrar por unidade</option>';
    lucide.createIcons();
}

function filterAvailableStudents() {
    if (!selectedClass) {
        return;
    }
    const search = document.getElementById('student-search-available')?.value.toLowerCase() || '';
    const unitFilter = document.getElementById('student-unit-filter')?.value || '';
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
    if (unitFilterSelect) {
        const currentSelectedUnit = unitFilterSelect.value;
        const units = [...new Set(potentialStudents.map(student => student.unidade).filter(unit => unit && allowedUnits.includes(unit)))];
        units.sort();
        unitFilterSelect.innerHTML = '<option value="">Filtrar por unidade</option>' + 
            units.map(unit => `<option value="${unit}">${unit}</option>`).join('');

        if (currentSelectedUnit && units.includes(currentSelectedUnit)) {
            unitFilterSelect.value = currentSelectedUnit;
        }
    }

    const availableStudents = unitFilter ?
        potentialStudents.filter(student => student.unidade === unitFilter) :
        potentialStudents;

    const div = document.getElementById('available-students');
    if (div) {
        div.innerHTML = availableStudents.length === 0 ?
            '<div class="text-center py-4 text-gray-500">Nenhuma turma selecionada.</div>' :
            availableStudents.map(student => {
                // Normalizar o valor de student.pcd para comparação
                const pcdValue = student.pcd ? student.pcd.trim().toLowerCase() : '';
                const isPcd = pcdValue === 'com deficiência';
                console.log(`Aluno disponível: ${student.name}, pcd: ${student.pcd}, normalizado: ${pcdValue}, é PCD: ${isPcd}`);
                return `
                    <div class="flex items-center justify-between p-3 border rounded-md hover:bg-gray-50">
                        <div>
                            <p class="font-medium inline-flex items-center">
                                ${student.name}
                                ${isPcd ? '<i data-lucide="accessibility" class="h-4 w-4 ml-2 text-blue-500 pcd-icon"></i>' : ''}
                            </p>
                            <p class="text-sm text-gray-500">Unidade: ${student.unidade || 'Não especificado'}</p>
                            <p class="text-sm text-gray-500">${student.etapa}</p>
                        </div>
                        <button onclick="enrollStudent('${student.id}', this)" class="bg-blue-600 text-white px-3 py-1 rounded-md flex items-center">
                            <i data-lucide="plus" class="h-4 w-4 mr-1"></i>
                            Matricular
                        </button>
                    </div>
                `;
            }).join('');
        // Forçar a renderização dos ícones com um pequeno atraso para garantir que o DOM esteja pronto
        setTimeout(() => {
            lucide.createIcons();
            console.log('Ícones renderizados em filterAvailableStudents');
            // Verificar quebras de linha após a renderização
            checkLineBreaks('available-students');
        }, 100);
    }
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

    // Atualizar o enrollmentCount com base no número real de matrículas
    selectedClass.enrollmentCount = enrollments.filter(e => String(e.classId) === String(selectedClass.id)).length;
    console.log('Atualizando enrollmentCount:', { classId: selectedClass.id, enrollmentCount: selectedClass.enrollmentCount });

    div.innerHTML = enrolledStudents.length === 0 ?
        '<div class="text-center py-4 text-gray-500">Nenhum aluno matriculado nesta turma.</div>' :
        enrolledStudents.map(student => {
            // Normalizar o valor de student.pcd para comparação
            const pcdValue = student.pcd ? student.pcd.trim().toLowerCase() : '';
            const isPcd = pcdValue === 'com deficiência';
            console.log(`Aluno matriculado: ${student.name}, pcd: ${student.pcd}, normalizado: ${pcdValue}, é PCD: ${isPcd}`);
            return `
                <div class="flex items-center justify-between p-3 border rounded-md hover:bg-gray-50">
                    <div>
                        <p class="font-medium inline-flex items-center">
                            ${student.name}
                            ${isPcd ? '<i data-lucide="accessibility" class="h-4 w-4 ml-2 text-blue-500 pcd-icon"></i>' : ''}
                        </p>
                        <p class="text-sm text-gray-500">Unidade: ${student.unidade || 'Não especificado'}</p>
                        <p class="text-sm text-gray-500">${student.etapa}</p>
                    </div>
                    <button onclick="unenrollStudent('${student.id}', this)" class="bg-red-600 text-white px-3 py-1 rounded-md flex items-center">
                        <i data-lucide="trash-2" class="h-4 w-4 mr-1"></i>
                        Remover
                    </button>
                </div>
            `;
        }).join('');

    // Forçar a renderização dos ícones com um pequeno atraso para garantir que o DOM esteja pronto
    setTimeout(() => {
        lucide.createIcons();
        console.log('Ícones renderizados em renderEnrolledStudents');
        // Verificar quebras de linha após a renderização
        checkLineBreaks('enrolled-students');
    }, 100);

    updateSelectedClassDetails();
}

async function enrollStudent(studentId, button) {
    try {
        toggleButtonsState(true, button);
        const response = await retryFetch('/api/matriculas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ alunoId: studentId, turmaId: selectedClass.id }),
            credentials: 'include'
        });
        const newEnrollment = response;
        console.log('Nova matrícula criada:', newEnrollment);

        // Verificar se newEnrollment é válido
        if (!newEnrollment || !newEnrollment.id) {
            throw new Error('Resposta inválida do backend: matrícula não contém ID');
        }

        // Invalidar caches
        invalidateCaches();

        // Recarregar dados globais
        await loadData();

        // Re-selecionar a turma atual
        if (selectedClass) {
            selectClass(selectedClass.id);
        }

        showToast('Aluno matriculado com sucesso!', 'success', 'check-circle');
    } catch (error) {
        console.error('Erro ao matricular aluno:', error.message);
        showToast('Erro: ' + error.message, 'error', 'alert-circle');
        // Mesmo com erro, recarregar dados para garantir consistência
        await loadData();
        if (selectedClass) {
            selectClass(selectedClass.id);
        }
    } finally {
        toggleButtonsState(false, button);
        lucide.createIcons();
    }
}

async function unenrollStudent(studentId, button) {
    try {
        toggleButtonsState(true, button);
        const enrollment = enrollments.find(e => e.studentId === studentId && e.classId === selectedClass.id);
        if (!enrollment) throw new Error('Matrícula não encontrada');
        const response = await retryFetch(`/api/matriculas/${enrollment.id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        console.log('Matrícula removida:', enrollment.id);

        // Invalidar caches
        invalidateCaches();

        // Recarregar dados globais
        await loadData();

        // Re-selecionar a turma atual
        if (selectedClass) {
            selectClass(selectedClass.id);
        }

        showToast('Aluno removido da turma com sucesso!', 'success', 'trash-2');
    } catch (error) {
        console.error('Erro ao remover matrícula:', error.message);
        showToast('Erro: ' + error.message, 'error', 'alert-circle');
        // Mesmo com erro, recarregar dados para verificar o estado real
        await loadData();
        if (selectedClass) {
            selectClass(selectedClass.id);
        }
    } finally {
        toggleButtonsState(false, button);
        lucide.createIcons();
    }
}

function updateSelectedClassDetails() {
    if (!selectedClass) return;
    const classType = selectedClass.type === 'cognitiva' ? 'Cognitiva' : 'Motora';
    const className = extractClassName(selectedClass.name);
    const capitalizedName = capitalizeFirstLetter(className);
    const title = document.getElementById('selected-class-title');
    const details = document.getElementById('selected-class-details');

    if (title) {
        title.innerHTML = `
            ${capitalizedName}
            <span class="class-type-tag ${selectedClass.type}">${classType}</span>
        `;
    }
    if (details) {
        details.innerHTML = `
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
    }
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
    console.log('Inicializando Lucide e carregando dados');
    console.log('Lucide carregada:', typeof lucide, lucide.createIcons);
    lucide.createIcons();

    const filterCognitiva = document.getElementById('filter-cognitiva');
    const filterMotora = document.getElementById('filter-motora');
    const classSearch = document.getElementById('class-search');
    const dayFilter = document.getElementById('day-filter');
    const periodFilter = document.getElementById('period-filter');
    const poloFilter = document.getElementById('polo-filter');
    const gradeFilter = document.getElementById('grade-filter');
    const closeSelectedClass = document.getElementById('close-selected-class');
    const studentSearch = document.getElementById('student-search-available');
    const studentUnitFilter = document.getElementById('student-unit-filter');

    if (filterCognitiva) filterCognitiva.addEventListener('click', () => filterClasses('cognitiva'));
    if (filterMotora) filterMotora.addEventListener('click', () => filterClasses('motora'));
    if (classSearch) classSearch.addEventListener('input', () => filterClasses());
    if (dayFilter) dayFilter.addEventListener('change', () => filterClasses());
    if (periodFilter) periodFilter.addEventListener('change', () => filterClasses());
    if (poloFilter) poloFilter.addEventListener('change', () => filterClasses());
    if (gradeFilter) gradeFilter.addEventListener('change', () => filterClasses());
    if (closeSelectedClass) closeSelectedClass.addEventListener('click', deselectClass);
    if (studentSearch) studentSearch.addEventListener('input', filterAvailableStudents);
    if (studentUnitFilter) studentUnitFilter.addEventListener('change', filterAvailableStudents);

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