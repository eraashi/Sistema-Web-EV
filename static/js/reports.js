let students = [];
let classes = [];
let enrollments = [];

async function fetchData() {
    try {
        const responses = await Promise.all([
            fetch('/api/alunos'),
            fetch('/api/turmas'),
            fetch('/api/matriculas')
        ]);
        if (!responses.every(r => r.ok)) throw new Error('Erro ao carregar dados');

        const [alunosData, classesData, enrollmentsData] = await Promise.all(responses.map(r => r.json()));
        console.log('Dados brutos:', { alunosData, classesData, enrollmentsData });

        // A rota /api/alunos retorna { data: [...], ... }, então pegamos o array de data
        students = Array.isArray(alunosData.data) ? alunosData.data : [];
        classes = Array.isArray(classesData) ? classesData : [];
        enrollments = Array.isArray(enrollmentsData) ? enrollmentsData : [];

        console.log('Alunos:', students);
        console.log('Turmas:', classes);
        console.log('Matrículas:', enrollments);

        renderReports();
    } catch (error) {
        alert('Erro: ' + error.message);
        window.location.href = '/login';
    }
}

function renderReports() {
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
                            <p class="text-sm text-gray-500">ID: ${student.id} | ${student.grade}º Ano</p>
                            <p class="text-sm text-gray-500">Turmas: ${classNames}</p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
}

document.addEventListener('DOMContentLoaded', fetchData);