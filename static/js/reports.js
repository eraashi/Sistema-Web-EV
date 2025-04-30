let students = [];
let classes = [];
let enrollments = [];
let activeClasses = [];

async function fetchData() {
    try {
        const responses = await Promise.all([
            fetch('/api/alunos', { credentials: 'include' }),
            fetch('/api/turmas', { credentials: 'include' }),
            fetch('/api/matriculas', { credentials: 'include' }),
            fetch('/api/turmas_ativas', { credentials: 'include' })
        ]);
        if (!responses.every(r => r.ok)) {
            const failedResponse = responses.find(r => !r.ok);
            const errorText = await failedResponse.text();
            throw new Error(`Erro ao carregar dados: ${failedResponse.url} retornou status ${failedResponse.status}. Detalhes: ${errorText}`);
        }

        const [alunosData, classesData, enrollmentsData, activeClassesData] = await Promise.all(responses.map(r => r.json()));
        console.log('Dados brutos:', { alunosData, classesData, enrollmentsData, activeClassesData });

        students = Array.isArray(alunosData.data) ? alunosData.data : [];
        classes = Array.isArray(classesData) ? classesData : [];
        enrollments = Array.isArray(enrollmentsData) ? enrollmentsData : [];
        activeClasses = Array.isArray(activeClassesData.turmas) ? activeClassesData.turmas : [];

        console.log('Alunos:', students);
        console.log('Turmas:', classes);
        console.log('Matrículas:', enrollments);
        console.log('Turmas Ativas:', activeClasses);

        renderReports(activeClassesData.current_period, activeClassesData.current_day);
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        alert('Erro: ' + error.message);
        window.location.href = '/login';
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

function openStudentsModal(classId) {
    console.log('Abrindo modal para turma ID:', classId);
    const cls = activeClasses.find(c => c.id === classId);
    if (!cls) {
        console.error('Turma não encontrada para ID:', classId);
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

    console.log('Exibindo modal com', cls.students.length, 'alunos');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    console.log('Fechando modal');
    const modal = document.getElementById('students-modal');
    modal.classList.add('hidden');
    document.body.style.overflow = '';
}

// Fechar modal ao clicar fora do conteúdo
document.getElementById('students-modal').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) {
        closeModal();
    }
});

function renderReports(currentPeriod, currentDay) {
    // Atualizar o turno e dia atuais
    document.getElementById('current-period').textContent = currentPeriod === 'manha' ? 'Manhã' : 'Tarde';
    document.getElementById('current-day').textContent = currentDay ? formatSchedule(currentDay, null, false) : 'Sem aulas hoje';

    // Contagem de turmas ativas
    document.getElementById('active-classes-count').textContent = `${activeClasses.length} turmas ativas`;

    // Renderizar cards de turmas ativas
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
                    <button onclick="openStudentsModal('${cls.id}')" style="background-color: #3b82f6; color: white; padding: 0.5rem 1rem; border-radius: 0.375rem; margin-top: 1rem; display: flex; align-items: center; justify-content: center; font-size: 0.875rem; transition: background-color 0.2s;">
                        <i data-lucide="users" class="h-4 w-4 mr-1"></i>
                        Ver Alunos (${cls.enrollmentCount})
                    </button>
                </div>
            `;
        }).join('');

    // Distribuição por Disciplina
    const disciplineCounts = classes.reduce((acc, cls) => {
        const type = cls.subject;
        acc[type] = (acc[type] || 0) + cls.enrollmentCount;
        return acc;
    }, {});
    const disciplineCtx = document.getElementById('discipline-distribution-chart').getContext('2d');
    new Chart(disciplineCtx, {
        type: 'pie',
        data: {
            labels: Object.keys(disciplineCounts),
            datasets: [{
                data: Object.values(disciplineCounts),
                backgroundColor: ['#1E3A8A', '#F97316']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.label}: ${context.raw} (${((context.raw / Object.values(disciplineCounts).reduce((a, b) => a + b, 0)) * 100).toFixed(1)}%)`
                    }
                }
            }
        }
    });

    // Distribuição por Dias da Semana
    const dayCounts = classes.reduce((acc, cls) => {
        acc[cls.day] = (acc[cls.day] || 0) + cls.enrollmentCount;
        return acc;
    }, {});
    const dayCtx = document.getElementById('day-distribution-chart').getContext('2d');
    new Chart(dayCtx, {
        type: 'bar',
        data: {
            labels: Object.keys(dayCounts),
            datasets: [{
                label: 'Alunos Matriculados',
                data: Object.values(dayCounts),
                backgroundColor: '#1E3A8A'
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });

    // Taxa de Ocupação Geral
    const totalCapacity = classes.reduce((sum, cls) => sum + cls.capacity, 0);
    const totalEnrolled = enrollments.length;
    const occupancyRate = totalCapacity ? (totalEnrolled / totalCapacity * 100).toFixed(0) : 0;
    document.getElementById('occupancy-rate').textContent = `${occupancyRate}%`;
    document.getElementById('occupancy-details').textContent = `${totalEnrolled} alunos matriculados de ${totalCapacity} vagas totais`;

    // Alunos Matriculados
    const enrolledStudents = Array.isArray(students) ? students.filter(student => enrollments.some(e => e.studentId === student.id)) : [];
    const enrolledDiv = document.getElementById('enrolled-students');
    enrolledDiv.innerHTML = enrolledStudents.length === 0 ?
        '<div class="text-center py-4 text-gray-500">Nenhum aluno matriculado.</div>' :
        enrolledStudents.map(student => {
            const studentEnrollments = enrollments.filter(e => e.studentId === student.id);
            const classNames = studentEnrollments.map(e => {
                const cls = classes.find(c => c.id === e.classId);
                return cls ? cls.name : '';
            }).join(', ');
            return `
                <div class="flex items-center justify-between p-3 border rounded-md hover:bg-gray-50">
                    <div class="flex items-center">
                        <div class="h-10 w-10 rounded-full bg-blue-600 text-white flex items-center justify-center mr-3">
                            ${student.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)}
                        </div>
                        <div>
                            <p class="font-medium">${student.name}</p>
                            <p class="text-sm text-gray-500">ID: ${student.id} | ${student.etapa}</p>
                            <p class="text-sm text-gray-500">Turmas: ${classNames}</p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    // Inicializar ícones Lucide
    lucide.createIcons();
}

// Estilização para a tag de tipo
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

document.addEventListener('DOMContentLoaded', fetchData);