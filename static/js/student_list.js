let students = [];
let currentPage = 1;
let totalPages = 1;
let totalAlunos = 0;
let currentFilters = {};

async function fetchStudents(page = 1, filters = {}) {
    try {
        const params = new URLSearchParams({ page, per_page: 100 });
        for (const [key, value] of Object.entries(filters)) {
            if (value) {
                params.append(key, value);
            }
        }
        console.log('Parâmetros enviados para /api/alunos:', params.toString());
        const response = await fetch(`/api/alunos?${params.toString()}`, { credentials: 'include' });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro ao carregar alunos: ${errorText}`);
        }
        const data = await response.json();
        students = data.data;
        totalPages = data.total_pages;
        currentPage = data.current_page;
        totalAlunos = data.total_alunos;
        console.log('Alunos carregados:', students);
        renderStudents();
        updatePagination();
    } catch (error) {
        console.error('Erro em fetchStudents:', error.message);
        alert('Erro: ' + error.message);
        window.location.href = '/login';
    }
}

function renderStudents() {
    const tbody = document.getElementById('student-table-body');
    tbody.innerHTML = '';

    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="px-6 py-4 text-center text-gray-500">Nenhum aluno encontrado com os filtros selecionados.</td></tr>';
    } else {
        students.forEach(student => {
            const statusClass = student.status === 'complete' ? 'badge-complete' : student.status === 'partial' ? 'badge-partial' : 'badge-pending';
            const statusText = student.status === 'complete' ? 'Completo' : student.status === 'partial' ? 'Parcial' : 'Pendente';
            tbody.innerHTML += `
                <tr>
                    <td class="px-6 py-4">
                        <div class="flex items-center">
                            <div class="h-10 w-10 rounded-full bg-blue-600 text-white flex items-center justify-center mr-3">
                                ${student.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)}
                            </div>
                            <div class="font-medium">${student.name}</div>
                        </div>
                    </td>
                    <td class="px-6 py-4">${student.matricula}</td>
                    <td class="px-6 py-4">${student.polo_name}</td>
                    <td class="px-6 py-4">${student.turma_unidade || 'Não especificado'}</td>
                    <td class="px-6 py-4">${student.genero || 'Não especificado'}</td>
                    <td class="px-6 py-4">${student.pcd || 'Não especificado'}</td>
                    <td class="px-6 py-4">${student.unidade || 'Não especificado'}</td>
                    <td class="px-6 py-4">${student.etapa || 'Não especificado'}</td>
                    <td class="px-6 py-4">
                        <span class="badge ${statusClass}">${statusText}</span>
                    </td>
                </tr>
            `;
        });
    }
}

function updatePagination() {
    const paginationTopDiv = document.getElementById('pagination-top');
    const paginationBottomDiv = document.getElementById('pagination');
    if (!paginationTopDiv || !paginationBottomDiv) return;

    const resultsOnPage = students.length;
    const totalResults = totalAlunos;

    const paginationContent = `
        <div class="flex justify-center items-center" style="gap: 24px;">
            <div class="flex items-center space-x-2">
                <button onclick="fetchStudents(${currentPage - 1}, currentFilters)" ${currentPage === 1 ? 'disabled' : ''} class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300">Anterior</button>
                <span>Página ${currentPage} de ${totalPages}</span>
                <button onclick="fetchStudents(${currentPage + 1}, currentFilters)" ${currentPage === totalPages ? 'disabled' : ''} class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300">Próxima</button>
            </div>
            <span>Exibindo ${resultsOnPage} de ${totalResults}</span>
        </div>
    `;

    // Renderizar no topo
    paginationTopDiv.innerHTML = paginationContent;
    const topControls = paginationTopDiv.querySelector('.flex.justify-center.items-center');
    const topControlsStyles = topControls ? window.getComputedStyle(topControls) : {};
    console.log('Estilos do container de paginação (topo):', {
        gap: topControlsStyles.gap
    });

    // Renderizar no final
    paginationBottomDiv.innerHTML = paginationContent;
    const bottomControls = paginationBottomDiv.querySelector('.flex.justify-center.items-center');
    const bottomControlsStyles = bottomControls ? window.getComputedStyle(bottomControls) : {};
    console.log('Estilos do container de paginação (final):', {
        gap: bottomControlsStyles.gap
    });
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('filter-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        currentFilters = Object.fromEntries(formData);
        console.log('Filtros aplicados:', currentFilters);
        fetchStudents(1, currentFilters);
    });
});