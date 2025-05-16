const buscaAtivaData = [
    {
        id_aluno: 'AL001',
        nome_aluno: 'Ana Silva',
        turma: 'Robótica',
        turma_id: 'T001',
        polo: 'Polo Central',
        ultima_presenca: '2025-04-30',
        percentual_faltas: 60,
        trocou_turma: true,
        retornou: false,
        contato: { telefone: '(11) 99999-1111', email: 'ana.silva@email.com', responsavel: 'Maria Silva' }
    },
    {
        id_aluno: 'AL002',
        nome_aluno: 'Bruno Costa',
        turma: 'Inglês',
        turma_id: 'T002',
        polo: 'Polo Norte',
        ultima_presenca: '2025-05-01',
        percentual_faltas: 20,
        trocou_turma: false,
        retornou: true,
        contato: { telefone: '(11) 99999-2222', email: 'bruno.costa@email.com', responsavel: 'João Costa' }
    },
    {
        id_aluno: 'AL003',
        nome_aluno: 'Clara Mendes',
        turma: 'Jiu-Jitsu',
        turma_id: 'T003',
        polo: 'Polo Sul',
        ultima_presenca: '2025-05-03',
        percentual_faltas: 80,
        trocou_turma: false,
        retornou: false,
        contato: { telefone: '(11) 99999-3333', email: 'clara.mendes@email.com', responsavel: 'Sofia Mendes' }
    }
];

let relatoriosBuscaAtiva = [
    {
        id: 'BA001',
        id_aluno: 'AL001',
        funcionario_id: 'F001',
        funcionario_nome: 'João Almeida',
        data: '2025-05-10',
        resultado: 'Contato com responsável; aluno retornará na próxima semana.',
        sucesso: true
    },
    {
        id: 'BA002',
        id_aluno: 'AL003',
        funcionario_id: 'F002',
        funcionario_nome: 'Maria Souza',
        data: '2025-05-11',
        resultado: 'Sem resposta após 3 tentativas.',
        sucesso: false
    }
];

const funcionarios = [
    { id: 'F001', nome: 'João Almeida', cargo: 'Professor', retornos: 10, tentativas: 15 },
    { id: 'F002', nome: 'Maria Souza', cargo: 'Secretaria', retornos: 3, tentativas: 20 }
];

const fictionalPolos = [
    { id: 'P001', nome: 'Polo Central' },
    { id: 'P002', nome: 'Polo Norte' },
    { id: 'P003', nome: 'Polo Sul' }
];

const fictionalTurmas = [
    { id: 'T001', name: 'Robótica' },
    { id: 'T002', name: 'Inglês' },
    { id: 'T003', name: 'Jiu-Jitsu' }
];

async function fetchPolos() {
    try {
        const response = await fetch('/api/polos', { credentials: 'include' });
        if (!response.ok) throw new Error(`Erro ao carregar polos: ${await response.text()}`);
        return await response.json();
    } catch (error) {
        console.error('Erro em fetchPolos:', error.message);
        return fictionalPolos;
    }
}

async function fetchTurmas() {
    try {
        const response = await fetch('/api/turmas', { credentials: 'include' });
        if (!response.ok) throw new Error(`Erro ao carregar turmas: ${await response.text()}`);
        return await response.json();
    } catch (error) {
        console.error('Erro em fetchTurmas:', error.message);
        return fictionalTurmas;
    }
}

function formatDateToBrazilian(dateStr) {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
}

function isEvadido(ultimaPresenca) {
    const lastDate = new Date(ultimaPresenca);
    const today = new Date('2025-05-14');
    const diffDays = (today - lastDate) / (1000 * 60 * 60 * 24);
    return diffDays > 10;
}

function filterBuscaAtiva(data) {
    const poloFilter = document.getElementById('filter-polo').value;
    const startDateFilter = document.getElementById('filter-start-date').value;
    const endDateFilter = document.getElementById('filter-end-date').value;
    const turmaFilter = document.getElementById('filter-turma').value;

    const startDate = startDateFilter ? new Date(startDateFilter.split('/').reverse().join('-')) : null;
    const endDate = endDateFilter ? new Date(endDateFilter.split('/').reverse().join('-')) : null;

    return data.filter(item => {
        const ultimaPresenca = new Date(item.ultima_presenca);
        const matchesPolo = poloFilter === 'all' || item.polo === poloFilter;
        const matchesDate = (!startDate || ultimaPresenca >= startDate) && (!endDate || ultimaPresenca <= endDate);
        const matchesTurma = turmaFilter === 'all' || item.turma_id === turmaFilter;
        return matchesPolo && matchesDate && matchesTurma;
    });
}

function filterRelatorios(relatorios) {
    const funcionarioFilter = document.getElementById('filter-funcionario').value;
    return relatorios.filter(r => funcionarioFilter === 'all' || r.funcionario_id === funcionarioFilter);
}

let currentPage = 1;
const itemsPerPage = 10;

function renderBuscaAtiva(data, turmas) {
    const buscaAtivaSection = document.getElementById('busca-ativa-section');
    const paginationSection = document.getElementById('pagination-section');

    buscaAtivaSection.innerHTML = '';
    paginationSection.innerHTML = '';

    const filteredData = filterBuscaAtiva(data);
    const totalItems = filteredData.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    if (currentPage > totalPages) {
        currentPage = totalPages || 1;
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const currentItems = filteredData.slice(startIndex, endIndex);

    currentItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'bg-gray-50 p-4 rounded-lg shadow-md transition-all duration-300 hover:bg-blue-50';
        const status = [];
        if (isEvadido(item.ultima_presenca)) status.push('<span class="text-[#EF4444]">Evadido >10 dias</span>');
        if (item.percentual_faltas > 50) status.push('<span class="text-yellow-500">Muitas faltas</span>');
        if (item.trocou_turma) status.push('<span class="text-[#3B82F6]">Trocou de turma</span>');
        if (item.retornou) status.push('<span class="text-[#10B981]">Retornou</span>');

        card.innerHTML = `
            <h3 class="text-lg font-semibold text-gray-900">${item.nome_aluno}</h3>
            <p class="text-sm text-gray-600">Turma: ${item.turma}</p>
            <p class="text-sm text-gray-600">Polo: ${item.polo}</p>
            <p class="text-sm text-gray-600">Última Presença: ${formatDateToBrazilian(item.ultima_presenca)}</p>
            <p class="text-sm text-gray-600">Faltas: ${item.percentual_faltas}%</p>
            <p class="text-sm text-gray-600">Status: ${status.join(', ')}</p>
            <div class="flex justify-end mt-4">
                <button class="contact-btn bg-[#3B82F6] text-white px-3 py-1 rounded-md hover:bg-[#1E3A8A] flex items-center">
                    <i data-lucide="phone" class="h-4 w-4 mr-1"></i>
                    Contatar
                </button>
            </div>
        `;

        card.querySelector('.contact-btn').addEventListener('click', () => openContactModal(item));
        buscaAtivaSection.appendChild(card);
    });

    if (totalItems > 0) {
        const prevButton = document.createElement('button');
        prevButton.className = `px-4 py-2 rounded-md ${currentPage === 1 ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-[#3B82F6] text-white hover:bg-[#1E3A8A]'}`;
        prevButton.textContent = 'Anterior';
        prevButton.disabled = currentPage === 1;
        prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderBuscaAtiva(data, turmas);
            }
        });

        const pageNumbers = document.createElement('div');
        pageNumbers.className = 'flex space-x-1';
        const maxVisiblePages = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        if (startPage > 1) {
            const firstPage = document.createElement('button');
            firstPage.className = 'px-4 py-2 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300';
            firstPage.textContent = '1';
            firstPage.addEventListener('click', () => {
                currentPage = 1;
                renderBuscaAtiva(data, turmas);
            });
            pageNumbers.appendChild(firstPage);

            if (startPage > 2) {
                const dots = document.createElement('span');
                dots.className = 'px-4 py-2 text-gray-700';
                dots.textContent = '...';
                pageNumbers.appendChild(dots);
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            const pageButton = document.createElement('button');
            pageButton.className = `px-4 py-2 rounded-md ${i === currentPage ? 'bg-[#3B82F6] text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`;
            pageButton.textContent = i;
            pageButton.addEventListener('click', () => {
                currentPage = i;
                renderBuscaAtiva(data, turmas);
            });
            pageNumbers.appendChild(pageButton);
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const dots = document.createElement('span');
                dots.className = 'px-4 py-2 text-gray-700';
                dots.textContent = '...';
                pageNumbers.appendChild(dots);
            }

            const lastPage = document.createElement('button');
            lastPage.className = 'px-4 py-2 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300';
            lastPage.textContent = totalPages;
            lastPage.addEventListener('click', () => {
                currentPage = totalPages;
                renderBuscaAtiva(data, turmas);
            });
            pageNumbers.appendChild(lastPage);
        }

        const nextButton = document.createElement('button');
        nextButton.className = `px-4 py-2 rounded-md ${currentPage === totalPages ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-[#3B82F6] text-white hover:bg-[#1E3A8A]'}`;
        nextButton.textContent = 'Próximo';
        nextButton.disabled = currentPage === totalPages;
        nextButton.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                renderBuscaAtiva(data, turmas);
            }
        });

        paginationSection.appendChild(prevButton);
        paginationSection.appendChild(pageNumbers);
        paginationSection.appendChild(nextButton);
    }
}

function renderRelatorios(relatorios) {
    const relatoriosSection = document.getElementById('relatorios-section');
    relatoriosSection.innerHTML = '';

    const filteredRelatorios = filterRelatorios(relatorios);
    filteredRelatorios.forEach(r => {
        const card = document.createElement('div');
        card.className = 'bg-gray-50 p-4 rounded-lg shadow-md';
        card.innerHTML = `
            <p class="text-sm text-gray-600"><strong>Aluno:</strong> ${buscaAtivaData.find(a => a.id_aluno === r.id_aluno)?.nome_aluno || 'Desconhecido'}</p>
            <p class="text-sm text-gray-600"><strong>Funcionário:</strong> ${r.funcionario_nome}</p>
            <p class="text-sm text-gray-600"><strong>Data:</strong> ${formatDateToBrazilian(r.data)}</p>
            <p class="text-sm text-gray-600"><strong>Resultado:</strong> ${r.resultado}</p>
            <p class="text-sm text-gray-600"><strong>Sucesso:</strong> ${r.sucesso ? '<span class="text-[#10B981]">Sim</span>' : '<span class="text-[#EF4444]">Não</span>'}</p>
        `;
        relatoriosSection.appendChild(card);
    });
}

function renderDesempenhoChart(funcionarios) {
    const desempenhoCtx = document.getElementById('desempenho-chart').getContext('2d');
    new Chart(desempenhoCtx, {
        type: 'bar',
        data: {
            labels: funcionarios.map(f => f.nome),
            datasets: [
                {
                    label: 'Retornos',
                    data: funcionarios.map(f => f.retornos),
                    backgroundColor: '#3B82F6' // Azul claro do Escola Viva
                },
                {
                    label: 'Tentativas',
                    data: funcionarios.map(f => f.tentativas),
                    backgroundColor: '#1E3A8A' // Azul escuro do Escola Viva
                }
            ]
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
}

function openContactModal(aluno) {
    const modal = document.getElementById('contact-modal');
    const modalTitle = document.getElementById('modal-title');
    const studentDetails = document.getElementById('student-details');
    const resultado = document.getElementById('resultado');
    const sucesso = document.getElementById('sucesso');
    const saveButton = document.getElementById('save-report');
    const closeButton = document.getElementById('close-modal');

    modalTitle.textContent = `Contato com ${aluno.nome_aluno}`;
    studentDetails.innerHTML = `
        <p class="text-sm text-gray-600"><strong>Turma:</strong> ${aluno.turma}</p>
        <p class="text-sm text-gray-600"><strong>Polo:</strong> ${aluno.polo}</p>
        <p class="text-sm text-gray-600"><strong>Telefone:</strong> ${aluno.contato.telefone}</p>
        <p class="text-sm text-gray-600"><strong>Email:</strong> ${aluno.contato.email}</p>
        <p class="text-sm text-gray-600"><strong>Responsável:</strong> ${aluno.contato.responsavel}</p>
    `;
    resultado.value = '';
    sucesso.value = 'true';

    modal.classList.add('active');

    saveButton.addEventListener('click', () => {
        const data = {
            id: `BA${relatoriosBuscaAtiva.length + 1}`,
            id_aluno: aluno.id_aluno,
            funcionario_id: 'F001', // Placeholder; substituir por ID do usuário logado
            funcionario_nome: 'João Almeida', // Placeholder; substituir por nome do usuário logado
            data: new Date().toISOString().split('T')[0],
            resultado: resultado.value,
            sucesso: sucesso.value === 'true'
        };
        relatoriosBuscaAtiva.push(data);
        renderRelatorios(relatoriosBuscaAtiva);
        modal.classList.remove('active');
    });

    closeButton.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const polos = await fetchPolos();
    const turmas = await fetchTurmas();

    const poloSelect = document.getElementById('filter-polo');
    poloSelect.innerHTML = '<option value="all">Todos os polos</option>' + polos.map(polo => `
        <option value="${polo.nome}">${polo.nome}</option>
    `).join('');

    const turmaSelect = document.getElementById('filter-turma');
    turmaSelect.innerHTML = '<option value="all">Todas as turmas</option>' + turmas.map(turma => `
        <option value="${turma.id}">${turma.name}</option>
    `).join('');

    const funcionarioSelect = document.getElementById('filter-funcionario');
    funcionarioSelect.innerHTML = '<option value="all">Todos os funcionários</option>' + funcionarios.map(f => `
        <option value="${f.id}">${f.nome}</option>
    `).join('');

    flatpickr("#filter-start-date", {
        dateFormat: "d/m/Y",
        defaultDate: new Date(new Date().setDate(new Date().getDate() - 30)),
        onChange: () => {
            currentPage = 1;
            renderBuscaAtiva(buscaAtivaData, turmas);
        }
    });

    flatpickr("#filter-end-date", {
        dateFormat: "d/m/Y",
        defaultDate: new Date(),
        onChange: () => {
            currentPage = 1;
            renderBuscaAtiva(buscaAtivaData, turmas);
        }
    });

    renderBuscaAtiva(buscaAtivaData, turmas);
    renderRelatorios(relatoriosBuscaAtiva);
    renderDesempenhoChart(funcionarios);

    const filters = ['filter-polo', 'filter-start-date', 'filter-end-date', 'filter-turma'];
    filters.forEach(filterId => {
        document.getElementById(filterId).addEventListener('change', () => {
            currentPage = 1;
            renderBuscaAtiva(buscaAtivaData, turmas);
        });
    });

    document.getElementById('filter-funcionario').addEventListener('change', () => {
        renderRelatorios(relatoriosBuscaAtiva);
    });

    lucide.createIcons();
});