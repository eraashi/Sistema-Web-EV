let students = [];
let currentPage = 1;
let totalPages = 1;
let totalAlunos = 0;
let currentFilters = {};

const retryFetch = async (url, options, retries = 2, delay = 500) => {
    const cacheKey = `cache_${url}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        try {
            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < 10000 && data && data.data && Array.isArray(data.data)) {
                return data;
            } else {
                localStorage.removeItem(cacheKey);
            }
        } catch (e) {
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
            } catch (e) {}
            return data;
        } catch (error) {
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw error;
            }
        }
    }
};

async function fetchStudents(page = 1, filters = {}) {
    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    overlay.innerHTML = '<div class="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>';
    document.body.appendChild(overlay);

    const mainContent = document.querySelector('.mb-6');
    if (mainContent) {
        mainContent.classList.add('pointer-events-none');
    }

    try {
        students = [];
        let isRendered = false;

        const params = new URLSearchParams({ page, per_page: 100 });
        for (const [key, value] of Object.entries(filters)) {
            if (value) {
                params.append(key, value);
            }
        }
        const url = `/api/alunos_paginados?${params.toString()}`;

        const cacheKey = `cache_${url}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                const { data, timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp < 10000 && data && Array.isArray(data.data)) {
                    students = data.data;
                    totalPages = data.total_pages;
                    currentPage = data.current_page;
                    totalAlunos = data.total_alunos;
                    isRendered = true;
                    renderStudents();
                    updatePagination();
                } else {
                    localStorage.removeItem(cacheKey);
                }
            } catch (e) {
                localStorage.removeItem(cacheKey);
            }
        }

        const data = await retryFetch(url, { credentials: 'include' });
        students = Array.isArray(data.data) ? data.data : [];
        totalPages = data.total_pages || 1;
        currentPage = data.current_page || 1;
        totalAlunos = data.total_alunos || 0;

        if (!isRendered || students.length > 0) {
            renderStudents();
            updatePagination();
        }

        if (overlay && mainContent) {
            overlay.remove();
            mainContent.classList.remove('pointer-events-none');
        }
    } catch (error) {
        showToast('Erro ao carregar alunos: ' + error.message, 'error', 'alert-circle', 3000);
        renderStudents();
        if (overlay && mainContent) {
            overlay.remove();
            mainContent.classList.remove('pointer-events-none');
        }
    }
}

function renderStudents() {
    const tbody = document.getElementById('student-table-body');
    tbody.innerHTML = '';

    if (students.length === 0) {
        const colspan = currentUserRole === 'admin' || currentUserRole === 'secretaria' || currentUserRole === 'coordenador' ? 10 : 9;
        tbody.innerHTML = `<tr><td colspan="${colspan}" class="px-6 py-4 text-center text-gray-500">Nenhum aluno encontrado com os filtros selecionados.</td></tr>`;
    } else {
        students.forEach(student => {
            const statusClass = student.status === 'complete' ? 'badge-complete' : student.status === 'partial' ? 'badge-partial' : 'badge-pending';
            const statusText = student.status === 'complete' ? 'Completo' : student.status === 'partial' ? 'Parcial' : 'Pendente';
            const editButton = (currentUserRole === 'admin' || currentUserRole === 'secretaria' || currentUserRole === 'coordenador')
                ? `<td class="px-6 py-4">
                       <button class="edit-button" onclick='openEditModal(${JSON.stringify(student)})'>
                           <i data-lucide="edit" class="h-4 w-4 mr-1"></i> Editar
                       </button>
                   </td>`
                : '';
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
                    ${editButton}
                </tr>
            `;
        });
        lucide.createIcons();
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

    paginationTopDiv.innerHTML = paginationContent;
    paginationBottomDiv.innerHTML = paginationContent;
}

function openEditModal(student) {
    const modal = document.getElementById('edit-student-modal');
    if (!modal) {
        return;
    }
    modal.style.display = 'block';

    document.getElementById('edit-student-id').value = student.id || '';
    document.getElementById('edit-name').value = student.name || '';
    document.getElementById('edit-polo-name').value = student.polo_name || 'POLO I (Porto da Roça)';

    const unidadeSelect = document.getElementById('edit-unidade');
    if (student.unidade && unidadeSelect.querySelector(`option[value="${student.unidade}"]`)) {
        unidadeSelect.value = student.unidade;
    } else {
        unidadeSelect.value = '';
    }

    const generoSelect = document.getElementById('edit-genero');
    if (student.genero && generoSelect.querySelector(`option[value="${student.genero}"]`)) {
        generoSelect.value = student.genero;
    } else {
        generoSelect.value = 'Masculino';
    }

    const pcdSelect = document.getElementById('edit-pcd');
    if (student.pcd && pcdSelect.querySelector(`option[value="${student.pcd}"]`)) {
        pcdSelect.value = student.pcd;
    } else {
        pcdSelect.value = 'Sem Deficiência';
    }

    const etapaSelect = document.getElementById('edit-etapa');
    if (student.etapa && etapaSelect.querySelector(`option[value="${student.etapa}"]`)) {
        etapaSelect.value = student.etapa;
    } else {
        etapaSelect.value = '4º Ano';
    }

    const turnoSelect = document.getElementById('edit-turno');
    if (student.turno && turnoSelect.querySelector(`option[value="${student.turno.toLowerCase()}"]`)) {
        turnoSelect.value = student.turno.toLowerCase();
    } else {
        turnoSelect.value = 'manha';
    }

    const dataNascimentoInput = document.getElementById('edit-data-nascimento');
    if (student.data_nascimento) {
        const date = new Date(student.data_nascimento);
        if (!isNaN(date.getTime())) {
            const formattedDate = date.toISOString().split('T')[0];
            dataNascimentoInput.value = formattedDate;
        } else {
            dataNascimentoInput.value = '';
        }
    } else {
        dataNascimentoInput.value = '';
    }
}

function closeEditModal() {
    const modal = document.getElementById('edit-student-modal');
    if (!modal) {
        return;
    }
    modal.style.display = 'none';
}

async function saveStudentChanges(event) {
    event.preventDefault();
    const form = document.getElementById('edit-student-form');
    const formData = new FormData(form);
    const studentData = Object.fromEntries(formData);

    try {
        const updateResponse = await retryFetch(`/api/alunos/${studentData.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(studentData),
            credentials: 'include'
        });
        showToast('Dados do aluno salvos com sucesso!', 'success', 'check-circle', 3000);

        const unenrollResponse = await retryFetch(`/api/alunos/${studentData.id}/unenroll`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        showToast('Aluno desenturmado com sucesso! É necessário enturmá-lo novamente.', 'warning', 'alert-circle', 5000);

        closeEditModal();
        fetchStudents(currentPage, currentFilters);
    } catch (error) {
        showToast('Erro: ' + error.message, 'error', 'alert-circle', 3000);
    }
}

function showToast(message, type, icon, duration = 3000) {
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
    }, duration);

    const closeButton = toastDiv.querySelector('.custom-toast-close');
    closeButton.addEventListener('click', () => {
        clearTimeout(timeout);
        toastDiv.remove();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const filterForm = document.getElementById('filter-form');
    if (filterForm) {
        filterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            currentFilters = Object.fromEntries(formData);
            fetchStudents(1, currentFilters);
        });
    }

    const editForm = document.getElementById('edit-student-form');
    if (editForm) {
        editForm.addEventListener('submit', saveStudentChanges);
    }

    const modal = document.getElementById('edit-student-modal');
    if (modal) {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeEditModal();
            }
        });
    }
});