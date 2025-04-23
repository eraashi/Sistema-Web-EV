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
        console.log('Parâmetros enviados para /api/alunos_paginados:', params.toString());
        const response = await fetch(`/api/alunos_paginados?${params.toString()}`, { credentials: 'include' });
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
        // Ajustar o colspan com base no cargo do usuário
        const colspan = currentUserRole === 'admin' || currentUserRole === 'secretaria' || currentUserRole === 'coordenador' ? 10 : 9;
        tbody.innerHTML = `<tr><td colspan="${colspan}" class="px-6 py-4 text-center text-gray-500">Nenhum aluno encontrado com os filtros selecionados.</td></tr>`;
    } else {
        students.forEach(student => {
            const statusClass = student.status === 'complete' ? 'badge-complete' : student.status === 'partial' ? 'badge-partial' : 'badge-pending';
            const statusText = student.status === 'complete' ? 'Completo' : student.status === 'partial' ? 'Parcial' : 'Pendente';
            // Renderizar o botão "Editar" apenas para admin, secretaria e coordenador
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
        console.error('Modal element not found');
        return;
    }
    modal.style.display = 'block';

    // Preencher o formulário com os dados do aluno
    document.getElementById('edit-student-id').value = student.id || '';
    document.getElementById('edit-name').value = student.name || '';
    document.getElementById('edit-polo-name').value = student.polo_name || 'POLO I (Porto da Roça)';

    // Preencher a unidade com o valor exato do aluno
    const unidadeSelect = document.getElementById('edit-unidade');
    if (student.unidade && unidadeSelect.querySelector(`option[value="${student.unidade}"]`)) {
        unidadeSelect.value = student.unidade;
    } else {
        unidadeSelect.value = ''; // Deixa vazio se a unidade não for encontrada
    }

    // Preencher o gênero com o valor exato do aluno
    const generoSelect = document.getElementById('edit-genero');
    if (student.genero && generoSelect.querySelector(`option[value="${student.genero}"]`)) {
        generoSelect.value = student.genero;
    } else {
        generoSelect.value = 'Masculino'; // Valor padrão se não encontrado
    }

    // Preencher o PCD com o valor exato do aluno
    const pcdSelect = document.getElementById('edit-pcd');
    if (student.pcd && pcdSelect.querySelector(`option[value="${student.pcd}"]`)) {
        pcdSelect.value = student.pcd;
    } else {
        pcdSelect.value = 'Sem Deficiência'; // Valor padrão se não encontrado
    }

    // Preencher a etapa com o valor exato do aluno
    const etapaSelect = document.getElementById('edit-etapa');
    if (student.etapa && etapaSelect.querySelector(`option[value="${student.etapa}"]`)) {
        etapaSelect.value = student.etapa;
    } else {
        etapaSelect.value = '4º Ano'; // Valor padrão se não encontrado
    }

    // Preencher o turno com o valor exato do aluno
    const turnoSelect = document.getElementById('edit-turno');
    if (student.turno && turnoSelect.querySelector(`option[value="${student.turno.toLowerCase()}"]`)) {
        turnoSelect.value = student.turno.toLowerCase();
    } else {
        turnoSelect.value = 'manha'; // Valor padrão se não encontrado
    }

    // Preencher a data de nascimento com o valor exato do aluno
    const dataNascimentoInput = document.getElementById('edit-data-nascimento');
    if (student.data_nascimento) {
        // Certificar-se de que a data está no formato YYYY-MM-DD
        const date = new Date(student.data_nascimento);
        if (!isNaN(date.getTime())) {
            const formattedDate = date.toISOString().split('T')[0]; // Formato YYYY-MM-DD
            dataNascimentoInput.value = formattedDate;
        } else {
            dataNascimentoInput.value = ''; // Deixa vazio se a data for inválida
        }
    } else {
        dataNascimentoInput.value = ''; // Deixa vazio se não houver data
    }
}

function closeEditModal() {
    const modal = document.getElementById('edit-student-modal');
    if (!modal) {
        console.error('Modal element not found');
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
        // Atualizar os dados do aluno
        const updateResponse = await fetch(`/api/alunos/${studentData.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(studentData),
            credentials: 'include'
        });
        if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            throw new Error(`Erro ao atualizar aluno: ${errorText}`);
        }

        // Exibir toast de confirmação
        showToast('Dados do aluno salvos com sucesso!', 'success', 'check-circle', 3000);

        // Desmatricular o aluno de todas as turmas
        const unenrollResponse = await fetch(`/api/alunos/${studentData.id}/unenroll`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        if (!unenrollResponse.ok) {
            const errorText = await unenrollResponse.text();
            throw new Error(`Erro ao desmatricular aluno: ${errorText}`);
        }

        // Exibir toast de alerta
        showToast('Aluno desenturmado com sucesso! É necessário enturmá-lo novamente.', 'warning', 'alert-circle', 5000);

        // Fechar o modal e recarregar os alunos
        closeEditModal();
        fetchStudents(currentPage, currentFilters);
    } catch (error) {
        console.error('Erro ao salvar alterações:', error.message);
        showToast('Erro: ' + error.message, 'error', 'alert-circle', 3000);
    }
}

function showToast(message, type, icon, duration = 3000) {
    const toastContainer = document.getElementById('custom-toast-container');
    if (!toastContainer) {
        console.error('Toast container not found');
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
    document.getElementById('filter-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        currentFilters = Object.fromEntries(formData);
        console.log('Filtros aplicados:', currentFilters);
        fetchStudents(1, currentFilters);
    });

    document.getElementById('edit-student-form').addEventListener('submit', saveStudentChanges);
});