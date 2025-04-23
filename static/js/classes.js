(function () {
    let classes = [];

    async function fetchClasses() {
        try {
            const response = await fetch('/api/turmas', { credentials: 'include' });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erro ao carregar turmas: ${errorText}`);
            }
            classes = await response.json();
            console.log('Turmas carregadas:', classes);
            console.log('Tipos de turmas disponíveis:', [...new Set(classes.map(cls => cls.type))]);
            const motorClasses = classes.filter(cls => cls.type === 'motora');
            console.log('Número de turmas motoras:', motorClasses.length);
            console.log('Turmas motoras:', motorClasses);
            renderClasses();
        } catch (error) {
            console.error('Erro em fetchClasses:', error.message);
            alert('Erro: ' + error.message);
            window.location.href = '/login';
        }
    }

    function filterClasses(type) {
        console.log(`Filtrando turmas do tipo: ${type}`);
        const filtered = type ? classes.filter(cls => {
            const matchesType = cls.type === type;
            console.log(`Turma ${cls.name}: type=${cls.type}, matches=${matchesType}`);
            return matchesType;
        }) : classes;
        console.log('Turmas filtradas:', filtered);
        renderClasses(filtered);

        document.querySelectorAll('button').forEach(btn => {
            btn.classList.remove('bg-blue-600', 'text-white');
            btn.classList.add('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
        });
        if (type) {
            document.querySelector(`#filter-${type}`).classList.remove('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
            document.querySelector(`#filter-${type}`).classList.add('bg-blue-600', 'text-white', 'hover:bg-blue-700');
        }
    }

    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
    }

    function extractClassName(name) {
        const match = name.match(/^[^0-9]+/i);
        return match ? match[0].trim() : name;
    }

    function renderClasses(filteredClasses = classes) {
        const tbody = document.getElementById('class-table-body');
        tbody.innerHTML = '';

        if (filteredClasses.length === 0) {
            // Ajustar o colspan com base no cargo do usuário
            const colspan = currentUserRole === 'admin' || currentUserRole === 'secretaria' || currentUserRole === 'coordenador' ? 8 : 7;
            tbody.innerHTML = `<tr><td colspan="${colspan}" class="px-6 py-4 text-center text-gray-500">Nenhuma turma encontrada.</td></tr>`;
        } else {
            filteredClasses.forEach((cls, index) => {
                const icon = cls.type === 'motora' ? 'fast-forward' : 'brain';
                const iconColor = cls.type === 'motora' ? 'text-purple-600' : 'text-green-600';
                const typeClass = cls.type === 'cognitiva' ? 'bg-green-100 text-green-600' : 'bg-purple-100 text-purple-600';
                const typeText = cls.type === 'cognitiva' ? 'Cognitiva' : 'Motora';
                const firstName = extractClassName(cls.name);
                const capitalizedName = capitalizeFirstLetter(firstName);
                console.log(`Turma ${cls.name}: type=${cls.type}, typeClass=${typeClass}`);
                const typeStyle = cls.type === 'motora' ? 'style="background-color: #f3e8ff"' : '';
                // Renderizar o botão "Editar" apenas para admin, secretaria e coordenador
                const editButton = (currentUserRole === 'admin' || currentUserRole === 'secretaria' || currentUserRole === 'coordenador')
                    ? `<td class="px-6 py-4">
                           <button class="edit-button" data-index="${index}">
                               <i data-lucide="edit" class="h-4 w-4 mr-1"></i> Editar
                           </button>
                       </td>`
                    : '';
                tbody.innerHTML += `
                    <tr>
                        <td class="px-6 py-4">
                            <div class="flex items-center">
                                <i data-lucide="${icon}" class="h-10 w-10 ${iconColor} flex items-center justify-center mr-3"></i>
                                <div>
                                    <div class="font-medium">${capitalizedName}</div>
                                    <div class="text-sm text-gray-500">Faixa etária: ${formatGrades(cls.grades)} anos</div>
                                </div>
                            </div>
                        </td>
                        <td class="px-6 py-4">${cls.polo_name}</td>
                        <td class="px-6 py-4">
                            <span class="inline-flex px-2 py-1 rounded-full text-xs font-medium ${typeClass}" ${typeStyle}>
                                ${typeText}
                            </span>
                        </td>
                        <td class="px-6 py-4">${formatGrades(cls.grades)}</td>
                        <td class="px-6 py-4">${formatSchedule(cls.day)}</td>
                        <td class="px-6 py-4">${cls.period}</td>
                        <td class="px-6 py-4">
                            ${cls.enrollmentCount}/${cls.capacity}
                            <div class="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                                <div class="bg-blue-600 h-2.5 rounded-full" style="width: ${(cls.enrollmentCount / cls.capacity * 100).toFixed(0)}%"></div>
                            </div>
                        </td>
                        ${editButton}
                    </tr>
                `;
            });

            // Adicionar event listeners para os botões "Editar"
            const editButtons = document.querySelectorAll('.edit-button');
            console.log('Botões "Editar" encontrados:', editButtons.length);
            editButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const index = button.getAttribute('data-index');
                    console.log('Botão "Editar" clicado, índice:', index);
                    openEditModal(index);
                });
            });
        }
        lucide.createIcons();
    }

    function formatSchedule(day) {
        const days = {
            monday: 'Segunda-feira',
            tuesday: 'Terça-feira',
            wednesday: 'Quarta-feira',
            thursday: 'Quinta-feira',
            friday: 'Sexta-feira',
            seg: 'Segunda-feira',
            ter: 'Terça-feira',
            qua: 'Quarta-feira',
            qui: 'Quinta-feira',
            sex: 'Sexta-feira'
        };
        return days[day] || day;
    }

    function formatGrades(grades) {
        if (!grades) {
            console.warn('grades está vazio ou indefinido:', grades);
            return 'Não especificado';
        }

        let gradesString;
        if (Array.isArray(grades)) {
            gradesString = grades.join(',');
        } else if (typeof grades === 'string') {
            gradesString = grades;
        } else {
            console.warn('grades não é uma string nem um array:', grades);
            return 'Não especificado';
        }

        try {
            return gradesString.split(',').map(g => `${g.trim()}º`).join(' e ');
        } catch (error) {
            console.error('Erro ao formatar grades:', error, 'grades:', grades);
            return 'Não especificado';
        }
    }

    function openEditModal(index) {
        console.log('openEditModal chamado com index:', index);
        const cls = classes[index];
        console.log('Dados da turma:', cls);
        if (!cls) {
            console.error('Turma não encontrada no índice:', index);
            return;
        }

        const modal = document.getElementById('edit-class-modal');
        if (!modal) {
            console.error('Modal element not found');
            return;
        }
        console.log('Modal encontrado, alterando display para block');
        modal.style.display = 'block';

        // Preencher o formulário com os dados da turma
        document.getElementById('edit-class-id').value = cls.id || '';
        document.getElementById('edit-name').value = cls.name || '';
        document.getElementById('edit-polo-name').value = cls.polo_name || 'POLO I (Porto da Roça)';
        document.getElementById('edit-type').value = cls.type || 'cognitiva';

        // Preencher o par de etapas com o valor exato da turma
        const gradesSelect = document.getElementById('edit-grades');
        const gradesValue = JSON.stringify(cls.grades); // Ex.: ["4", "5"]
        if (gradesSelect.querySelector(`option[value='${gradesValue}']`)) {
            gradesSelect.value = gradesValue;
        } else {
            gradesSelect.value = '["4", "5"]'; // Valor padrão se não encontrado
        }

        // Preencher o dia da semana com o valor exato da turma
        const daySelect = document.getElementById('edit-day');
        if (cls.day && daySelect.querySelector(`option[value="${cls.day}"]`)) {
            daySelect.value = cls.day;
        } else {
            daySelect.value = 'seg'; // Valor padrão se não encontrado
        }

        // Preencher o período com o valor exato da turma
        const periodSelect = document.getElementById('edit-period');
        if (cls.period && periodSelect.querySelector(`option[value="${cls.period.toLowerCase()}"]`)) {
            periodSelect.value = cls.period.toLowerCase();
        } else {
            periodSelect.value = 'manha'; // Valor padrão se não encontrado
        }

        // Preencher a capacidade com o valor exato da turma
        document.getElementById('edit-capacity').value = cls.capacity || 0;
    }

    function closeEditModal() {
        const modal = document.getElementById('edit-class-modal');
        if (!modal) {
            console.error('Modal element not found');
            return;
        }
        console.log('Fechando modal, alterando display para none');
        modal.style.display = 'none';
    }

    async function saveClassChanges(event) {
        event.preventDefault();
        const form = document.getElementById('edit-class-form');
        const formData = new FormData(form);
        const classData = Object.fromEntries(formData);
        // Parsear o valor de grades (que é uma string JSON) para um array
        classData.grades = JSON.parse(classData.grades); // Ex.: ["4", "5"]
        console.log('Dados enviados para atualização:', classData);
        console.log('ID da turma:', classData.id);
        console.log('URL da requisição:', `/api/turmas/${classData.id}`);

        try {
            // Atualizar os dados da turma
            const updateResponse = await fetch(`/api/turmas/${classData.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(classData),
                credentials: 'include'
            });
            if (!updateResponse.ok) {
                const errorText = await updateResponse.text();
                throw new Error(`Erro ao atualizar turma: ${errorText}`);
            }

            // Exibir toast de confirmação
            showToast('Dados da turma salvos com sucesso!', 'success', 'check-circle', 3000);

            // Desmatricular todos os alunos da turma
            const unenrollResponse = await fetch(`/api/turmas/${classData.id}/unenroll`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            if (!unenrollResponse.ok) {
                const errorText = await unenrollResponse.text();
                throw new Error(`Erro ao desmatricular alunos: ${errorText}`);
            }

            // Exibir toast de alerta
            showToast('Alunos desmatriculados com sucesso! É necessário matriculá-los novamente.', 'warning', 'alert-circle', 5000);

            // Fechar o modal e recarregar as turmas
            closeEditModal();
            fetchClasses();
        } catch (error) {
            console.error('Erro ao salvar alterações:', error.message);
            showToast('Erro: ' + error.message, 'error', 'alert-circle', 3000);
        }
    }

    function openCreateModal() {
        const modal = document.getElementById('create-class-modal');
        if (!modal) {
            console.error('Modal de criação not found');
            return;
        }
        console.log('Abrindo modal de criação');
        modal.style.display = 'block';

        // Limpar o formulário e os tooltips
        document.getElementById('create-class-form').reset();
        document.querySelectorAll('.tooltip').forEach(tooltip => {
            tooltip.style.display = 'none';
        });

        // Inicializar o ícone de tipo como "brain" (cognitiva)
        updateTypeIcon('cognitiva');
        lucide.createIcons();
    }

    function closeCreateModal() {
        const modal = document.getElementById('create-class-modal');
        if (!modal) {
            console.error('Modal de criação not found');
            return;
        }
        console.log('Fechando modal de criação');
        modal.style.display = 'none';
    }

    function updateTypeIcon(type) {
        const typeIcon = document.getElementById('type-icon');
        if (!typeIcon) return;

        // Remover o ícone existente
        typeIcon.removeAttribute('data-lucide');
        typeIcon.className = 'h-5 w-5 mr-2';

        // Definir o novo ícone
        typeIcon.setAttribute('data-lucide', type === 'cognitiva' ? 'brain' : 'fast-forward');
        lucide.createIcons();
    }

    function showTooltip(elementId, message) {
        console.log(`Exibindo tooltip para ${elementId}: ${message}`);
        const tooltip = document.getElementById(`tooltip-${elementId}`);
        if (tooltip) {
            tooltip.textContent = message;
            tooltip.style.display = 'block';
        } else {
            console.error(`Tooltip element tooltip-${elementId} not found`);
        }
    }

    async function createClass(event) {
        event.preventDefault();
        console.log('Evento de submissão disparado para createClass');

        const form = document.getElementById('create-class-form');
        if (!form) {
            console.error('Formulário create-class-form não encontrado');
            return;
        }

        const formData = new FormData(form);
        const classData = Object.fromEntries(formData);
        console.log('Dados do formulário:', classData);

        // Validação dos campos
        let hasError = false;
        const fields = [
            { id: 'name', message: 'Por favor, insira o nome da turma' },
            { id: 'type', message: 'Por favor, selecione o tipo da turma' },
            { id: 'day', message: 'Por favor, selecione o dia da semana' },
            { id: 'period', message: 'Por favor, selecione o período' },
            { id: 'grades', message: 'Por favor, selecione o ano escolar' },
            { id: 'polo_name', message: 'Por favor, selecione o polo' }, // Corrigido de 'polo-name' para 'polo_name'
            { id: 'capacity', message: 'Por favor, insira a capacidade da turma' }
        ];

        fields.forEach(field => {
            const value = classData[field.id];
            console.log(`Validando campo ${field.id}: Valor = "${value}"`);
            if (!value || value.trim() === '') {
                showTooltip(field.id, field.message);
                hasError = true;
            }
        });

        if (hasError) {
            console.log('Validação falhou: Campos obrigatórios não preenchidos');
            return; // Impede o salvamento e mantém o modal aberto
        }

        console.log('Validação bem-sucedida, prosseguindo com a criação da turma');

        // Parsear o valor de grades (que é uma string JSON) para um array
        try {
            classData.grades = JSON.parse(classData.grades); // Ex.: ["4", "5"]
            console.log('Dados após parse do grades:', classData);
        } catch (error) {
            console.error('Erro ao parsear grades:', error);
            showToast('Erro ao processar o ano escolar', 'error', 'alert-circle', 3000);
            return;
        }

        try {
            console.log('Enviando requisição para criar a turma...');
            const createResponse = await fetch('/api/turmas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(classData),
                credentials: 'include'
            });

            if (!createResponse.ok) {
                const errorText = await createResponse.text();
                console.error('Erro na resposta do servidor:', errorText);
                throw new Error(`Erro ao criar turma: ${errorText}`);
            }

            const responseData = await createResponse.json();
            console.log('Turma criada com sucesso:', responseData);

            // Exibir toast de confirmação
            showToast('Turma criada com sucesso!', 'success', 'check-circle', 3000);

            // Fechar o modal e recarregar as turmas
            closeCreateModal();
            fetchClasses();
        } catch (error) {
            console.error('Erro ao criar turma:', error.message);
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
        // Verificar se o elemento do modal de edição existe no DOM
        const editModal = document.getElementById('edit-class-modal');
        if (!editModal) {
            console.error('Elemento do modal (edit-class-modal) não encontrado no DOM');
        } else {
            console.log('Elemento do modal (edit-class-modal) encontrado no DOM');
        }

        // Verificar se o elemento do modal de criação existe no DOM
        const createModal = document.getElementById('create-class-modal');
        if (!createModal) {
            console.error('Elemento do modal (create-class-modal) não encontrado no DOM');
        } else {
            console.log('Elemento do modal (create-class-modal) encontrado no DOM');
        }

        // Verificar se o botão "Cancelar" do modal de edição existe no DOM e adicionar event listener
        const cancelEditButton = document.getElementById('cancel-edit-class');
        if (!cancelEditButton) {
            console.error('Botão "Cancelar" (cancel-edit-class) não encontrado no DOM');
        } else {
            console.log('Botão "Cancelar" (cancel-edit-class) encontrado no DOM');
            cancelEditButton.addEventListener('click', () => {
                console.log('Botão "Cancelar" clicado');
                closeEditModal();
            });
        }

        // Verificar se o botão "Cancelar" do modal de criação existe no DOM e adicionar event listener
        const cancelCreateButton = document.getElementById('cancel-create-class');
        if (!cancelCreateButton) {
            console.error('Botão "Cancelar" (cancel-create-class) não encontrado no DOM');
        } else {
            console.log('Botão "Cancelar" (cancel-create-class) encontrado no DOM');
            cancelCreateButton.addEventListener('click', () => {
                console.log('Botão "Cancelar" do modal de criação clicado');
                closeCreateModal();
            });
        }

        // Adicionar event listener para o botão "Nova Turma"
        const createClassButton = document.getElementById('create-class-button');
        if (createClassButton) {
            createClassButton.addEventListener('click', () => {
                console.log('Botão "Nova Turma" clicado');
                openCreateModal();
            });
        }

        // Adicionar event listener para o formulário de criação
        const createClassForm = document.getElementById('create-class-form');
        if (createClassForm) {
            createClassForm.addEventListener('submit', createClass);
        } else {
            console.error('Formulário create-class-form não encontrado no DOM');
        }

        // Adicionar event listener para alternar o ícone de tipo dinamicamente
        const typeSelect = document.getElementById('create-type');
        if (typeSelect) {
            typeSelect.addEventListener('change', (event) => {
                const selectedType = event.target.value;
                console.log('Tipo selecionado:', selectedType);
                updateTypeIcon(selectedType);
            });
        }

        fetchClasses();

        // Adicionar event listeners para os botões de filtro
        document.getElementById('filter-cognitiva').addEventListener('click', () => filterClasses('cognitiva'));
        document.getElementById('filter-motora').addEventListener('click', () => filterClasses('motora'));
        document.getElementById('edit-class-form').addEventListener('submit', saveClassChanges);
    });
})();