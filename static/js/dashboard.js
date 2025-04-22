let students = [];
let classes = [];
let enrollments = [];
let selectedClass = null;

async function loadData() {
    try {
        const responses = await Promise.all([
            fetch('/api/alunos', { credentials: 'include' }),
            fetch('/api/turmas', { credentials: 'include' }),
            fetch('/api/matriculas', { credentials: 'include' })
        ]);

        const failedResponse = responses.find(r => !r.ok);
        if (failedResponse) {
            const errorText = await failedResponse.text();
            throw new Error(`Erro na requisição: ${failedResponse.url} retornou status ${failedResponse.status}. Detalhes: ${errorText}`);
        }

        const [alunosData, classesData, enrollmentsData] = await Promise.all(responses.map(r => r.json()));

        students = Array.isArray(alunosData.data) ? alunosData.data : [];
        classes = Array.isArray(classesData) ? classesData : [];
        enrollments = Array.isArray(enrollmentsData) ? enrollmentsData : [];

        filterClasses('cognitiva');
    } catch (error) {
        showToast('Erro: ' + error.message, 'error', 'alert-circle');
        window.location.href = '/login';
    }
}

async function refreshEnrollments() {
    try {
        const response = await fetch('/api/matriculas', { credentials: 'include' });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro ao recarregar matrículas: ${errorText}`);
        }
        return await response.json();
    } catch (error) {
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

function filterClasses(type) {
    const search = document.getElementById('class-search').value.toLowerCase();
    const typeFilter = type || (document.querySelector('button.bg-blue-600')?.innerText.toLowerCase() === 'cognitivas' ? 'cognitiva' : 'motora');
    const dayFilter = document.getElementById('day-filter').value;
    const periodFilter = document.getElementById('period-filter').value;

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
        return matchesSearch && matchesType && matchesDay && matchesPeriod;
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
                            <p>Faixa etária: ${formatGrades(cls.grades)} anos</p>
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
    lucide.createIcons();
}

function filterAvailableStudents() {
    if (!selectedClass) {
        return;
    }
    const search = document.getElementById('student-search-available').value.toLowerCase();
    let acceptedGrades = extractAcceptedGrades(selectedClass.grades);

    // Extrair o nome base da turma selecionada (ex.: "Robótica")
    const selectedClassName = extractClassName(selectedClass.name).toLowerCase();

    const availableStudents = students.filter(student => {
        // Filtro de busca
        if (!(student.name.toLowerCase().includes(search) || student.id.includes(search))) {
            return false;
        }

        // Filtro de matrícula existente
        if (enrollments.some(e => e.studentId === student.id && e.classId === selectedClass.id)) {
            return false;
        }

        // Filtro por etapa (Regra 4)
        const studentGrade = extractStudentGrade(student.etapa);
        if (!(studentGrade !== null && acceptedGrades.includes(studentGrade))) {
            return false;
        }

        // Filtro por polo (Regra 4)
        const normalizedStudentPolo = student.polo_name.trim().toLowerCase();
        const normalizedClassPolo = selectedClass.polo_name.trim().toLowerCase();
        if (normalizedStudentPolo !== normalizedClassPolo) {
            return false;
        }

        // Regra 1: Máximo de 2 matrículas no mesmo dia da semana
        const studentEnrollments = enrollments.filter(e => e.studentId === student.id);
        const enrollmentsOnSameDay = studentEnrollments.filter(enrollment => {
            const enrolledClass = classes.find(cls => cls.id === enrollment.classId);
            return enrolledClass && enrolledClass.day === selectedClass.day;
        });
        if (enrollmentsOnSameDay.length >= 2) {
            return false;
        }

        // Regra 2: Alunos só podem ser enturmados no contraturno ao turno escolar
        const studentTurno = student.turno ? student.turno.toLowerCase() : null;
        const classPeriod = selectedClass.period ? selectedClass.period.toLowerCase() : null;
        const isContraturno = studentTurno && classPeriod && (
            (studentTurno === 'manha' && classPeriod === 'tarde') ||
            (studentTurno === 'tarde' && classPeriod === 'manha')
        );
        if (!isContraturno) {
            return false;
        }

        // Regra 3: Para turmas motoras, o aluno deve estar matriculado em uma turma cognitiva no mesmo dia e turno
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

        // Regra 5: Evitar matrículas em turmas repetidas (independente do dia)
        const hasSameClass = studentEnrollments.some(enrollment => {
            const enrolledClass = classes.find(cls => cls.id === enrollment.classId);
            return enrolledClass && extractClassName(enrolledClass.name).toLowerCase() === selectedClassName;
        });
        if (hasSameClass) {
            return false;
        }

        return true;
    });

    const div = document.getElementById('available-students');
    div.innerHTML = availableStudents.length === 0 ?
        '<div class="text-center py-4 text-gray-500">Nenhuma turma disponível para esta turma.</div>' :
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
        const response = await fetch('/api/matriculas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ alunoId: studentId, turmaId: selectedClass.id }),
            credentials: 'include'
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro ao matricular aluno: ${errorText}`);
        }
        const newEnrollment = await response.json();

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
        showToast('Erro: ' + error.message, 'error', 'alert-circle');
        lucide.createIcons();
    }
}

async function unenrollStudent(studentId) {
    try {
        const enrollment = enrollments.find(e => e.studentId === studentId && e.classId === selectedClass.id);
        if (!enrollment) throw new Error('Matrícula não encontrada');
        const response = await fetch(`/api/matriculas/${enrollment.id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro ao remover matrícula: ${errorText}`);
        }
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

    // Adicionar event listeners para os botões
    document.getElementById('filter-cognitiva').addEventListener('click', () => filterClasses('cognitiva'));
    document.getElementById('filter-motora').addEventListener('click', () => filterClasses('motora'));

    // Adicionar event listeners para o input de busca e os selects
    document.getElementById('class-search').addEventListener('input', () => filterClasses());
    document.getElementById('day-filter').addEventListener('change', () => filterClasses());
    document.getElementById('period-filter').addEventListener('change', () => filterClasses());

    // Adicionar event listener para o botão de fechar
    document.getElementById('close-selected-class').addEventListener('click', deselectClass);

    // Adicionar event listener para o input de busca de alunos disponíveis
    document.getElementById('student-search-available').addEventListener('input', filterAvailableStudents);
});