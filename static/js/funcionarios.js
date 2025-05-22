(function () {
    let currentFuncionario = null;
    let isEditing = false;
    let polos = [];
    let isFetching = false;

    // Mapeamento de polos e suas unidades correspondentes
    const poloUnidadesMap = {
        "POLO I (Bacaxá)": [
            "E.M. ANÍZIA ROSA DE OLIVEIRA COUTINHO",
            "E.M. LUCIANA SANTANA COUTINHO",
            "E.M. RUBENS DE LIMA CAMPOS",
            "E.M. VALTEMIR JOSÉ DA COSTA",
            "E.M. JOÃO MACHADO DA CUNHA",
            "E.M. JARDIM IPITANGAS",
            "E.M. LÚCIO NUNES",
            "E.M. MANOEL MUNIZ DA SILVA",
            "E.M. MARGARIDA ROSA DE AMORIM",
            "E.M. ELCIRA DE OLIVEIRA COUTINHO",
            "E.M. BEATRIZ AMARAL",
            "C.M.E. MENALDO CARLOS DE MAGALHÃES",
            "C.M.E. PADRE MANUEL",
            "E.M. PROFESSOR FRANCISCO VIGNOLI",
            "E.M. PAULO LUIZ BARROSO OLIVEIRA",
            "E.M. PREFEITO WALQUIDES DE SOUZA LIMA",
            "E.M. VILATUR",
            "E.M. THEÓFILO DÁVILA"
        ],
        "POLO II (Sampaio Correia)": [
            "E.M. EDILSON VIGNOLI MARINS",
            "E.M. MARIA LUIZA DE AMORIM MENDONÇA",
            "E.M. JOÃO LAUREANO DA SILVA",
            "C.M.E. JURANDIR DA SILVA MELO",
            "E.M. SEBASTIÃO MANOEL DOS REIS",
            "E.M. VEREADOR IVAN DA SILVA MELO",
            "E.M. EDILÊNIO SILVA DE SOUZA"
        ],
        "POLO III (Jaconé)": [
            "E.M. ISMÊNIA DE BARROS BARROSO"
        ],
        "POLO IV (Saquarema)": [
            "E.M. ORGÉ FERREIRA DOS SANTOS",
            "C.M. GUSTAVO CAMPOS DA SILVEIRA",
            "E.M. JOSÉ BANDEIRA",
            "E.M. PROFESSORA OSÍRIS PALMIER DA VEIGA",
            "E.M. PROFESSORA MARIA DE LOURDES MELO PAES BARRETO",
            "E.M. BELINO CATHARINO DE SOUZA"
        ]
    };

    const retryFetch = async (url, options, retries = 2, delay = 500) => {
        const cacheKey = `cache_${url}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                const { data, timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp < 10000 && data) {
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

    function createOverlay() {
        const existingOverlay = document.getElementById('loading-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
        const overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        overlay.innerHTML = '<div class="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>';
        if (document.body) {
            document.body.appendChild(overlay);
        }
        return overlay;
    }

    function removeOverlay(overlay) {
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
    }

    async function loadPolos() {
        const overlay = createOverlay();
        try {
            const polosData = await retryFetch('/api/polos', { credentials: 'include' });
            polos = Array.isArray(polosData) ? polosData : [];

            const poloSelect = document.getElementById('polo');
            const createPoloSelect = document.getElementById('create-polo');

            if (poloSelect) {
                poloSelect.innerHTML = '<option value="tudo">Tudo</option>';
                polos.forEach(polo => {
                    const option = document.createElement('option');
                    option.value = polo.nome;
                    option.textContent = polo.nome;
                    poloSelect.appendChild(option);
                });
            }

            if (createPoloSelect) {
                createPoloSelect.innerHTML = '<option value="" disabled selected hidden>Escolha um polo...</option>';
                polos.forEach(polo => {
                    const option = document.createElement('option');
                    option.value = polo.nome;
                    option.textContent = polo.nome;
                    createPoloSelect.appendChild(option);
                });
            }
        } catch (error) {
            showToast('Erro ao carregar polos: ' + error.message, 'error', 'alert-circle', 3000);
        } finally {
            removeOverlay(overlay);
        }
    }

    function updateUnidadesSelect(poloNome, unidadeSelectId) {
        const unidadeSelect = document.getElementById(unidadeSelectId);
        if (!unidadeSelect) return;

        unidadeSelect.innerHTML = '<option value="" selected>Não especificado</option>';
        const unidades = poloUnidadesMap[poloNome] || [];
        unidades.forEach(unidade => {
            const option = document.createElement('option');
            option.value = unidade;
            option.textContent = unidade;
            unidadeSelect.appendChild(option);
        });
    }

    async function searchFuncionarios() {
        if (isFetching) return;
        isFetching = true;

        const overlay = createOverlay();
        const nome = document.getElementById('nome').value;
        const cargo = document.getElementById('cargo').value;
        const polo = document.getElementById('polo').value;

        try {
            const queryParams = new URLSearchParams();
            if (nome) queryParams.append('nome', nome);
            if (cargo !== 'tudo') queryParams.append('cargo', cargo);
            if (polo !== 'tudo') queryParams.append('polo', polo);

            const funcionarios = await retryFetch(`/api/funcionarios?${queryParams.toString()}`, { credentials: 'include' });
            const sortedFuncionarios = Array.isArray(funcionarios) ? funcionarios.sort((a, b) => a.nome.localeCompare(b.nome)).slice(0, 50) : [];

            const funcionariosList = document.getElementById('funcionarios-list');
            funcionariosList.innerHTML = '';

            if (sortedFuncionarios.length === 0) {
                funcionariosList.innerHTML = '<p class="text-gray-500">Nenhum funcionário encontrado.</p>';
                return;
            }

            sortedFuncionarios.forEach(funcionario => {
                const div = document.createElement('div');
                div.className = 'p-2 hover:bg-gray-100 cursor-pointer border-b border-gray-200';
                div.textContent = `${funcionario.nome} (${funcionario.cargo}) - ${funcionario.polo_nome}`;
                div.dataset.id = funcionario.id;
                div.addEventListener('click', () => showFuncionarioDetails(funcionario.id));
                funcionariosList.appendChild(div);
            });
        } catch (error) {
            showToast('Erro ao buscar funcionários: ' + error.message, 'error', 'alert-circle', 3000);
            document.getElementById('funcionarios-list').innerHTML = '<p class="text-red-500">Erro ao buscar funcionários.</p>';
        } finally {
            removeOverlay(overlay);
            isFetching = false;
        }
    }

    async function showFuncionarioDetails(id) {
        const overlay = createOverlay();
        try {
            const funcionario = await retryFetch(`/api/funcionarios/${id}`, { credentials: 'include' });
            currentFuncionario = { ...funcionario, id };
            isEditing = false;
            renderFuncionarioDetails();
        } catch (error) {
            showToast('Erro ao buscar detalhes do funcionário: ' + error.message, 'error', 'alert-circle', 3000);
            document.getElementById('funcionario-details-content').innerHTML = '<p class="text-red-500">Erro ao carregar detalhes do funcionário.</p>';
            document.getElementById('funcionario-actions').innerHTML = '';
            document.getElementById('logs-list').innerHTML = '';
        } finally {
            removeOverlay(overlay);
        }
    }

    async function deleteFuncionario(id, nome) {
        if (!confirm(`Tem certeza que deseja excluir o cadastro de ${nome} do Banco de Dados?`)) return;
        if (!confirm('Essa ação é irreversível, pretende continuar?')) return;

        const overlay = createOverlay();
        try {
            await retryFetch(`/api/funcionarios/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            showToast('Funcionário excluído com sucesso!', 'success', 'check-circle', 3000);
            deselectFuncionario();
            await searchFuncionarios();
        } catch (error) {
            showToast('Erro: ' + error.message, 'error', 'alert-circle', 3000);
        } finally {
            removeOverlay(overlay);
        }
    }

    function renderFuncionarioDetails() {
        const detailsDiv = document.getElementById('funcionario-details-content');
        const actionsDiv = document.getElementById('funcionario-actions');
        const logsList = document.getElementById('logs-list');

        if (!currentFuncionario) {
            detailsDiv.innerHTML = '<p class="text-gray-500">Selecione um funcionário para visualizar os detalhes.</p>';
            actionsDiv.innerHTML = '';
            logsList.innerHTML = '';
            lucide.createIcons();
            return;
        }

        if (isEditing) {
            updateUnidadesSelect(currentFuncionario.polo_nome, 'edit-unidade');
            detailsDiv.innerHTML = `
                <div class="space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <p class="text-sm font-medium text-gray-500">Nome</p>
                            <input type="text" id="edit-nome" value="${currentFuncionario.nome}" class="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                        </div>
                        <div>
                            <p class="text-sm font-medium text-gray-500">CPF</p>
                            <input type="text" id="edit-cpf" value="${currentFuncionario.cpf}" class="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                        </div>
                        <div>
                            <p class="text-sm font-medium text-gray-500">Cargo</p>
                            <select id="edit-cargo" class="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                                <option value="monitor" ${currentFuncionario.cargo.toLowerCase() === 'monitor' ? 'selected' : ''}>Monitor</option>
                                <option value="diretor" ${currentFuncionario.cargo.toLowerCase() === 'diretor' ? 'selected' : ''}>Diretor</option>
                                <option value="coordenador" ${currentFuncionario.cargo.toLowerCase() === 'coordenador' ? 'selected' : ''}>Coordenador</option>
                            </select>
                        </div>
                        <div>
                            <p class="text-sm font-medium text-gray-500">Polo</p>
                            <select id="edit-polo" class="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                                ${polos.map(polo => `<option value="${polo.nome}" ${currentFuncionario.polo_nome === polo.nome ? 'selected' : ''}>${polo.nome}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <p class="text-sm font-medium text-gray-500">Unidade</p>
                            <select id="edit-unidade" class="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                                <!-- Opções preenchidas dinamicamente -->
                            </select>
                        </div>
                        <div>
                            <p class="text-sm font-medium text-gray-500">Data de Inclusão</p>
                            <p class="text-gray-900">${currentFuncionario.created_at || 'Não especificado'}</p>
                        </div>
                    </div>
                </div>
            `;
            actionsDiv.innerHTML = `
                <button id="cancel-btn" class="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600">Cancelar</button>
                <button id="save-btn" class="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">Salvar</button>
            `;
            document.getElementById('cancel-btn').addEventListener('click', cancelEdit);
            document.getElementById('save-btn').addEventListener('click', saveEdit);
            logsList.innerHTML = '';
        } else {
            detailsDiv.innerHTML = `
                <div class="space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <p class="text-sm font-medium text-gray-500">Nome</p>
                            <p class="text-gray-900">${currentFuncionario.nome}</p>
                        </div>
                        <div>
                            <p class="text-sm font-medium text-gray-500">CPF</p>
                            <p class="text-gray-900">${currentFuncionario.cpf}</p>
                        </div>
                        <div>
                            <p class="text-sm font-medium text-gray-500">Cargo</p>
                            <p class="text-gray-900">${currentFuncionario.cargo}</p>
                        </div>
                        <div>
                            <p class="text-sm font-medium text-gray-500">Polo</p>
                            <p class="text-gray-900">${currentFuncionario.polo_nome}</p>
                        </div>
                        <div>
                            <p class="text-sm font-medium text-gray-500">Unidade</p>
                            <p class="text-gray-900">${currentFuncionario.unidade || 'Não especificado'}</p>
                        </div>
                        <div>
                            <p class="text-sm font-medium text-gray-500">Data de Inclusão</p>
                            <p class="text-gray-900">${currentFuncionario.created_at || 'Não especificado'}</p>
                        </div>
                    </div>
                </div>
            `;
            actionsDiv.innerHTML = `
                <button id="deselect-btn" class="absolute top-4 right-4 text-gray-500 hover:text-gray-700">
                    <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
                <button id="edit-btn" class="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">Editar</button>
                <button id="delete-btn" class="delete-button">Excluir</button>
            `;
            document.getElementById('edit-btn').addEventListener('click', startEdit);
            document.getElementById('deselect-btn').addEventListener('click', deselectFuncionario);
            document.getElementById('delete-btn').addEventListener('click', () => deleteFuncionario(currentFuncionario.id, currentFuncionario.nome));

            logsList.innerHTML = currentFuncionario.logs && currentFuncionario.logs.length > 0
                ? currentFuncionario.logs.map(log => `
                    <div class="p-2 border-b border-gray-200">
                        <p class="text-sm text-gray-600">
                            <span class="font-medium">${log.action_type} ${log.entity_type}</span> - 
                            ${log.created_at} - 
                            ${JSON.stringify(log.details)}
                        </p>
                    </div>
                `).join('')
                : '<p class="text-gray-500 text-sm">Nenhum log recente encontrado.</p>';
        }

        lucide.createIcons();
    }

    function startEdit() {
        isEditing = true;
        renderFuncionarioDetails();
    }

    function cancelEdit() {
        isEditing = false;
        renderFuncionarioDetails();
    }

    async function saveEdit() {
        const overlay = createOverlay();
        const updatedFuncionario = {
            nome: document.getElementById('edit-nome').value,
            cpf: document.getElementById('edit-cpf').value,
            cargo: document.getElementById('edit-cargo').value,
            polo_name: document.getElementById('edit-polo').value,
            unidade: document.getElementById('edit-unidade').value || null
        };

        try {
            await retryFetch(`/api/funcionarios/${currentFuncionario.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(updatedFuncionario)
            });
            currentFuncionario.nome = updatedFuncionario.nome;
            currentFuncionario.cpf = updatedFuncionario.cpf;
            currentFuncionario.cargo = updatedFuncionario.cargo.charAt(0).toUpperCase() + updatedFuncionario.cargo.slice(1);
            currentFuncionario.polo_nome = updatedFuncionario.polo_name;
            currentFuncionario.unidade = updatedFuncionario.unidade;
            isEditing = false;
            renderFuncionarioDetails();
            await searchFuncionarios();
            showToast('Funcionário atualizado com sucesso!', 'success', 'check-circle', 3000);
        } catch (error) {
            showToast('Erro: ' + error.message, 'error', 'alert-circle', 3000);
        } finally {
            removeOverlay(overlay);
        }
    }

    function deselectFuncionario() {
        currentFuncionario = null;
        isEditing = false;
        renderFuncionarioDetails();
    }

    function openCreateModal() {
        const modal = document.getElementById('create-funcionario-modal');
        if (!modal) return;
        modal.style.display = 'block';
        document.getElementById('create-funcionario-form').reset();
        document.querySelectorAll('.tooltip').forEach(tooltip => tooltip.style.display = 'none');
        updateUnidadesSelect('', 'create-unidade');
        lucide.createIcons();
    }

    function closeCreateModal() {
        const modal = document.getElementById('create-funcionario-modal');
        if (!modal) return;
        modal.style.display = 'none';
    }

    async function createFuncionario(event) {
        event.preventDefault();
        const overlay = createOverlay();
        const form = document.getElementById('create-funcionario-form');
        const formData = new FormData(form);
        const funcionarioData = Object.fromEntries(formData);

        let hasError = false;
        const fields = [
            { id: 'nome', message: 'Por favor, insira o nome do funcionário' },
            { id: 'cpf', message: 'Por favor, insira o CPF do funcionário' },
            { id: 'cargo', message: 'Por favor, selecione o cargo' },
            { id: 'polo_name', message: 'Por favor, selecione o polo' }
        ];

        fields.forEach(field => {
            const value = funcionarioData[field.id];
            if (!value || value.trim() === '') {
                showTooltip(field.id, field.message);
                hasError = true;
            }
        });

        if (hasError) {
            removeOverlay(overlay);
            return;
        }

        try {
            await retryFetch('/api/funcionarios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(funcionarioData)
            });
            showToast('Funcionário criado com sucesso!', 'success', 'check-circle', 3000);
            closeCreateModal();
            await searchFuncionarios();
        } catch (error) {
            showToast('Erro: ' + error.message, 'error', 'alert-circle', 3000);
        } finally {
            removeOverlay(overlay);
        }
    }

    function showTooltip(elementId, message) {
        const tooltip = document.getElementById(`tooltip-${elementId}`);
        if (tooltip) {
            tooltip.textContent = message;
            tooltip.style.display = 'block';
        }
    }

    function showToast(message, type, icon, duration = 3000) {
        const toastContainer = document.getElementById('custom-toast-container');
        if (!toastContainer) return;

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

    document.addEventListener('DOMContentLoaded', async () => {
        lucide.createIcons(); // Inicializa ícones do menu lateral

        await loadPolos();

        document.getElementById('nome').addEventListener('input', searchFuncionarios);
        document.getElementById('cargo').addEventListener('change', searchFuncionarios);
        document.getElementById('polo').addEventListener('change', searchFuncionarios);

        const createFuncionarioButton = document.getElementById('create-funcionario-button');
        if (createFuncionarioButton) {
            createFuncionarioButton.addEventListener('click', openCreateModal);
        }

        const createModal = document.getElementById('create-funcionario-modal');
        if (createModal) {
            createModal.addEventListener('click', (event) => {
                if (event.target === createModal) {
                    closeCreateModal();
                }
            });
        }

        const cancelCreateButton = document.getElementById('cancel-create-funcionario');
        if (cancelCreateButton) {
            cancelCreateButton.addEventListener('click', closeCreateModal);
        }

        const createFuncionarioForm = document.getElementById('create-funcionario-form');
        if (createFuncionarioForm) {
            createFuncionarioForm.addEventListener('submit', createFuncionario);
        }

        const createPoloSelect = document.getElementById('create-polo');
        if (createPoloSelect) {
            createPoloSelect.addEventListener('change', () => {
                const selectedPolo = createPoloSelect.value;
                updateUnidadesSelect(selectedPolo, 'create-unidade');
            });
        }

        const editPoloSelect = document.getElementById('edit-polo');
        if (editPoloSelect) {
            editPoloSelect.addEventListener('change', () => {
                const selectedPolo = editPoloSelect.value;
                updateUnidadesSelect(selectedPolo, 'edit-unidade');
            });
        }

        await searchFuncionarios();
    }, { once: true });
})();