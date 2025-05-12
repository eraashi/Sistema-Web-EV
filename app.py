from flask import Flask, request, jsonify, render_template, session, redirect, url_for
from supabase import create_client
from dotenv import load_dotenv
import os
from retrying import retry
from datetime import datetime
import pytz

app = Flask(__name__)
load_dotenv()
app.secret_key = os.getenv('FLASK_SECRET_KEY')

# Configurar o Flask para usar cookies de sessão (armazenados no cliente)
app.config['SESSION_TYPE'] = 'null'  # Não usa armazenamento no servidor
app.config['SESSION_PERMANENT'] = True
app.config['PERMANENT_SESSION_LIFETIME'] = 3600  # 1 hora
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = False  # Alterar para True se usar HTTPS

# Configurar Supabase
supabase = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_ANON_KEY'))

# Função para retentativas
@retry(stop_max_attempt_number=3, wait_fixed=1000)
def execute_supabase_query(query):
    try:
        return query.execute().data
    except Exception as e:
        print(f"Erro na query: {str(e)}")
        raise

def get_current_user():
    print(f"Verificando usuário na sessão: {session.get('user_id')}")
    if 'user_id' not in session:
        print("Nenhum user_id encontrado na sessão")
        return None
    try:
        # Buscar o funcionário com os dados do polo associados
        funcionarios = execute_supabase_query(
            supabase.table('funcionarios').select('*, polos(nome)').eq('id', session['user_id'])
        )
        if not funcionarios or len(funcionarios) == 0:
            print("Funcionário não encontrado para o user_id na sessão")
            return None
        if len(funcionarios) > 1:
            print("Erro: Múltiplos funcionários encontrados para o mesmo user_id")
            return None
        funcionario = funcionarios[0]
        print(f"Funcionário encontrado: {funcionario}")
        return funcionario
    except Exception as e:
        print(f"Erro em get_current_user: {str(e)}")
        return None

# Função para registrar logs no Supabase
def log_action(user_id, action_type, entity_type, entity_id=None, details=None):
    try:
        log_data = {
            'user_id': user_id,
            'action_type': action_type,
            'entity_type': entity_type,
            'entity_id': str(entity_id) if entity_id else None,
            'details': details
        }
        print(f"Registrando log: {log_data}")
        response = supabase.table('logs').insert(log_data).execute()
        if not response.data:
            print("Erro ao registrar log")
        else:
            print("Log registrado com sucesso")
    except Exception as e:
        print(f"Erro ao registrar log: {str(e)}")

@app.route('/')
def index():
    user = get_current_user()
    if user:
        print(f"Usuário autenticado em /index, redirecionando para dashboard: {user['id']}")
        return redirect(url_for('dashboard'))
    print("Nenhum usuário autenticado em /index, redirecionando para login")
    return redirect(url_for('login'))

@app.route('/dashboard')
def dashboard():
    user = get_current_user()
    if not user:
        print("Nenhum usuário autenticado em /dashboard, redirecionando para login")
        return redirect(url_for('login'))
    print(f"Usuário autenticado em /dashboard: {user['id']}")
    return render_template('dashboard.html', user=user)

@app.route('/students')
def students():
    user = get_current_user()
    if not user:
        print("Nenhum usuário autenticado em /students, redirecionando para login")
        return redirect(url_for('login'))
    print(f"Usuário autenticado em /students: {user['id']}")
    return render_template('student_list.html', user=user)

@app.route('/reports')
def reports():
    user = get_current_user()
    if not user:
        print("Nenhum usuário autenticado em /reports, redirecionando para login")
        return redirect(url_for('login'))
    print(f"Usuário autenticado em /reports: {user['id']}")
    return render_template('reports.html', user=user)

@app.route('/reports_new')
def reports_new():
    user = get_current_user()
    if not user:
        print("Nenhum usuário autenticado em /reports_new, redirecionando para login")
        return redirect(url_for('login'))
    print(f"Usuário autenticado em /reports_new: {user['id']}")
    return render_template('reports_new.html', user=user)

@app.route('/reports_presences')
def reports_presences():
    user = get_current_user()
    if not user:
        print("Nenhum usuário autenticado em /reports_presences, redirecionando para login")
        return redirect(url_for('login'))
    print(f"Usuário autenticado em /reports_presences: {user['id']}")
    return render_template('reports_presences.html', user=user)

@app.route('/reports_occurrences')
def reports_occurrences():
    user = get_current_user()
    if not user:
        print("Nenhum usuário autenticado em /reports_occurrences, redirecionando para login")
        return redirect(url_for('login'))
    print(f"Usuário autenticado em /reports_occurrences: {user['id']}")
    return render_template('reports_occurrences.html', user=user)

@app.route('/classes')
def classes():
    user = get_current_user()
    if not user:
        print("Nenhum usuário autenticado em /classes, redirecionando para login")
        return redirect(url_for('login'))
    print(f"Usuário autenticado em /classes: {user['id']}")
    return render_template('classes.html', user=user)

@app.route('/new_class')
def new_class():
    user = get_current_user()
    if not user:
        print("Nenhum usuário autenticado em /new_class, redirecionando para login")
        return redirect(url_for('login'))
    print(f"Usuário autenticado em /new_class: {user['id']}")
    return render_template('new_class.html', user=user)

@app.route('/funcionarios')
def funcionarios():
    user = get_current_user()
    if not user:
        print("Nenhum usuário autenticado em /funcionarios, redirecionando para login")
        return redirect(url_for('login'))
    print(f"Usuário autenticado em /funcionarios: {user['id']}")
    return render_template('funcionarios.html', user=user)

@app.route('/logs')
def logs():
    user = get_current_user()
    if not user:
        print("Nenhum usuário autenticado em /logs, redirecionando para login")
        return redirect(url_for('login'))
    if user['cargo'] not in ['admin', 'secretaria']:
        print("Erro: Usuário não tem permissão para acessar os logs")
        return redirect(url_for('dashboard'))
    print(f"Usuário autenticado em /logs: {user['id']}")
    return render_template('logs.html', user=user)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        data = request.json
        cpf = data.get('cpf')
        password = data.get('password')
        print(f"Tentativa de login com CPF: {cpf}")
        try:
            funcionarios = execute_supabase_query(
                supabase.table('funcionarios').select('*').eq('cpf', cpf).eq('senha', password)
            )
            if not funcionarios or len(funcionarios) == 0:
                print("Funcionário não encontrado ou senha incorreta")
                return jsonify({'error': 'Invalid login credentials'}), 401
            if len(funcionarios) > 1:
                print("Erro: Múltiplos funcionários encontrados para o mesmo CPF e senha")
                return jsonify({'error': 'Multiple users found'}), 400
            funcionario = funcionarios[0]
            print(f"Funcionário autenticado: {funcionario['id']}")
            session['user_id'] = funcionario['id']
            print(f"Sessão atualizada: {session}")
            # Registrar log de login
            log_action(
                user_id=funcionario['id'],
                action_type='LOGIN',
                entity_type='USER',
                details={'cpf': cpf}
            )
            return jsonify({'user': funcionario, 'redirect': url_for('dashboard')})
        except Exception as e:
            print(f"Erro no login: {str(e)}")
            return jsonify({'error': 'Invalid login credentials'}), 401
    return render_template('login.html')

@app.route('/logout', methods=['POST'])
def logout():
    user = get_current_user()
    if user:
        # Registrar log de logout
        log_action(
            user_id=user['id'],
            action_type='LOGOUT',
            entity_type='USER',
            details={'cpf': user['cpf']}
        )
    session.pop('user_id', None)
    print("Usuário deslogado, sessão limpa")
    return jsonify({'message': 'Logout successful'})

@app.route('/api/presencas', methods=['GET'])
def get_presencas():
    user = get_current_user()
    if not user:
        print("Erro: Usuário não autenticado em /api/presencas")
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        # Buscar presenças com informações da turma e do polo
        query = supabase.from_('presenca').select(
            'id, id_aluno, matricula, nome_aluno, unidade, etapa, turno_escola_viva, presenca, data_escaneamento, hora_escaneamento, turma_id, turmas!turma_id(nome, faixa_etaria, polo_id, polos!turmas_polo_id_fkey(nome))'
        )

        # Filtrar com base no cargo do usuário
        if user['cargo'] in ['admin', 'secretaria']:
            print("Usuário admin ou secretaria: retornando todas as presenças")
            presencas = execute_supabase_query(query)
        elif user['cargo'] in ['monitor', 'diretor', 'coordenador']:
            # Verificar se o usuário tem um polo_id definido
            if 'polo_id' not in user or not user['polo_id']:
                print("Erro: Usuário sem polo_id definido")
                return jsonify({'error': 'Usuário não tem polo associado'}), 400

            # Filtrar apenas presenças de turmas do polo do usuário
            print(f"Filtrando presenças para o polo_id do usuário: {user['polo_id']}")
            presencas = execute_supabase_query(
                query.match({'turmas.polo_id': user['polo_id']})
            )
        else:
            print("Usuário sem permissão para visualizar presenças")
            presencas = []

        print(f"Presenças retornadas do Supabase: {presencas}")

        # Se não houver presenças, retornar uma lista vazia
        if not presencas:
            print("Nenhuma presença encontrada para o polo do usuário")
            return jsonify([])

        result = []
        for presenca in presencas:
            print(f"Processando presença: {presenca}")
            # Verificar se 'turmas' existe e não é None
            turma = presenca.get('turmas')
            if not turma:
                print(f"Turma não encontrada para a presença {presenca['id']}")
                turma = {}

            # Verificar se 'polos' existe dentro de 'turmas'
            polo = turma.get('polos', {}) if turma else {}
            print(f"Dados da turma para presença {presenca['id']}: {turma}")

            # Adicionar a presença ao resultado apenas se o polo_id da turma corresponder ao do usuário
            if user['cargo'] in ['monitor', 'diretor', 'coordenador']:
                turma_polo_id = turma.get('polo_id')
                if turma_polo_id != user['polo_id']:
                    print(f"Descartando presença {presenca['id']} - polo_id da turma ({turma_polo_id}) não corresponde ao polo_id do usuário ({user['polo_id']})")
                    continue

            result.append({
                'id': presenca['id'],
                'id_aluno': presenca['id_aluno'],
                'matricula': presenca['matricula'],
                'nome_aluno': presenca['nome_aluno'],
                'unidade': presenca['unidade'],
                'etapa': presenca['etapa'],
                'turno_escola_viva': presenca['turno_escola_viva'],
                'presenca': presenca['presenca'],
                'data_escaneamento': presenca['data_escaneamento'],
                'hora_escaneamento': presenca['hora_escaneamento'],
                'turma_id': presenca['turma_id'],
                'turma_nome': turma.get('nome', 'Não especificado'),
                'faixa_etaria': turma.get('faixa_etaria', []),
                'polo_nome': polo.get('nome', 'Não especificado')
            })
        print(f"Resultado final de presenças: {result}")
        return jsonify(result)
    except Exception as e:
        print(f"Erro em get_presencas: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/ocorrencias', methods=['GET'])
def get_ocorrencias():
    user = get_current_user()
    if not user:
        print("Erro: Usuário não autenticado em /api/ocorrencias")
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        # Buscar ocorrências com informações da turma e do polo
        query = supabase.table('ocorrencias').select(
            'id, turma_id, ocorrencia, data_escaneamento, turmas!turma_id(nome, faixa_etaria, periodo, polo_id, polos!turmas_polo_id_fkey(nome))'
        )

        # Filtrar com base no cargo do usuário
        if user['cargo'] in ['admin', 'secretaria']:
            print("Usuário admin ou secretaria: retornando todas as ocorrências")
            ocorrencias = execute_supabase_query(query)
        elif user['cargo'] in ['monitor', 'diretor', 'coordenador']:
            # Verificar se o usuário tem um polo_id definido
            if 'polo_id' not in user or not user['polo_id']:
                print("Erro: Usuário sem polo_id definido")
                return jsonify({'error': 'Usuário não tem polo associado'}), 400

            # Filtrar apenas ocorrências de turmas do polo do usuário
            print(f"Filtrando ocorrências para o polo_id do usuário: {user['polo_id']}")
            ocorrencias = execute_supabase_query(
                query.match({'turmas.polo_id': user['polo_id']})
            )
        else:
            print("Usuário sem permissão para visualizar ocorrências")
            ocorrencias = []

        print(f"Ocorrências retornadas do Supabase: {ocorrencias}")

        # Se não houver ocorrências, retornar uma lista vazia
        if not ocorrencias:
            print("Nenhuma ocorrência encontrada para o polo do usuário")
            return jsonify([])

        result = []
        for ocorrencia in ocorrencias:
            print(f"Processando ocorrência: {ocorrencia}")
            # Verificar se 'turmas' existe e não é None
            turma = ocorrencia.get('turmas')
            if not turma:
                print(f"Turma não encontrada para a ocorrência {ocorrencia['id']}")
                turma = {}

            # Verificar se 'polos' existe dentro de 'turmas'
            polo = turma.get('polos', {}) if turma else {}
            print(f"Dados da turma para ocorrência {ocorrencia['id']}: {turma}")

            # Adicionar a ocorrência ao resultado apenas se o polo_id da turma corresponder ao do usuário
            if user['cargo'] in ['monitor', 'diretor', 'coordenador']:
                turma_polo_id = turma.get('polo_id')
                if turma_polo_id != user['polo_id']:
                    print(f"Descartando ocorrência {ocorrencia['id']} - polo_id da turma ({turma_polo_id}) não corresponde ao polo_id do usuário ({user['polo_id']})")
                    continue

            result.append({
                'id': ocorrencia['id'],
                'turma_id': ocorrencia['turma_id'],
                'ocorrencia': ocorrencia['ocorrencia'],
                'data_escaneamento': ocorrencia['data_escaneamento'],
                'turma_nome': turma.get('nome', 'Não especificado'),
                'faixa_etaria': turma.get('faixa_etaria', []),
                'turno': turma.get('periodo', 'Não especificado'),
                'polo_nome': polo.get('nome', 'Não especificado')
            })
        print(f"Resultado final de ocorrências: {result}")
        return jsonify(result)
    except Exception as e:
        print(f"Erro em get_ocorrencias: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/funcionarios', methods=['GET', 'POST'])
def manage_funcionarios():
    user = get_current_user()
    if not user:
        print("Erro: Usuário não autenticado em /api/funcionarios")
        return jsonify({'error': 'Unauthorized'}), 401

    if request.method == 'GET':
        try:
            nome = request.args.get('nome', '').strip()
            cargo = request.args.get('cargo', '').strip()
            polo = request.args.get('polo', '').strip()

            query = supabase.table('funcionarios').select('id, nome, cpf, cargo, polo_id, polos!funcionarios_polo_id_fkey(nome), unidade, created_at')

            # Excluir funcionários com cargo "admin" ou "secretaria"
            query = query.not_.in_('cargo', ['admin', 'secretaria'])

            # Aplicar filtros
            if nome:
                query = query.ilike('nome', f'%{nome}%')
            if cargo and cargo != 'tudo':
                query = query.eq('cargo', cargo)
            if polo and polo != 'tudo':
                query = query.eq('polo_id', (
                    supabase.table('polos').select('id').eq('nome', polo).execute().data[0]['id']
                ))

            # Filtrar com base no cargo do usuário
            if user['cargo'] not in ['admin', 'secretaria']:
                # Apenas admin e secretaria podem ver todos os funcionários
                print("Erro: Usuário não tem permissão para acessar esta rota")
                return jsonify({'error': 'Forbidden: Apenas admin ou secretaria podem acessar esta rota'}), 403

            funcionarios = execute_supabase_query(query)

            # Definir o fuso horário de São Paulo
            sao_paulo_tz = pytz.timezone('America/Sao_Paulo')

            result = []
            for funcionario in funcionarios:
                # Capitalizar o cargo
                cargo = funcionario['cargo'].capitalize() if funcionario['cargo'] else 'Não especificado'

                # Formatar a data de criação para o padrão brasileiro
                created_at = 'Não especificado'
                if funcionario.get('created_at'):
                    try:
                        # Converter a string de data para um objeto datetime
                        created_at_dt = datetime.fromisoformat(funcionario['created_at'].replace('Z', '+00:00'))
                        # Converter para o fuso horário de São Paulo
                        created_at_dt = created_at_dt.astimezone(sao_paulo_tz)
                        # Formatar a data no padrão brasileiro
                        created_at = created_at_dt.strftime('%d/%m/%Y %H:%M:%S')
                    except Exception as e:
                        print(f"Erro ao formatar data de criação para {funcionario['id']}: {str(e)}")
                        created_at = 'Formato inválido'

                result.append({
                    'id': funcionario['id'],
                    'nome': funcionario['nome'],
                    'cpf': funcionario['cpf'],
                    'cargo': cargo,
                    'polo_id': funcionario['polo_id'],
                    'polo_nome': funcionario['polos']['nome'] if funcionario.get('polos') else 'Não especificado',
                    'unidade': funcionario.get('unidade', 'Não especificado'),
                    'created_at': created_at
                })

            print(f"Funcionários retornados: {result}")
            return jsonify(result)
        except Exception as e:
            print(f"Erro em get_funcionarios: {str(e)}")
            return jsonify({'error': str(e)}), 500

    elif request.method == 'POST':
        try:
            # Apenas admin e secretaria podem criar funcionários
            if user['cargo'] not in ['admin', 'secretaria']:
                print("Erro: Usuário não tem permissão para acessar esta rota")
                return jsonify({'error': 'Forbidden: Apenas admin ou secretaria podem acessar esta rota'}), 403

            data = request.json
            print(f"Dados recebidos para criação de funcionário: {data}")

            # Preparar os dados para inserção
            funcionario_data = {
                'nome': data.get('nome'),
                'cpf': data.get('cpf'),
                'cargo': data.get('cargo'),
                'polo_id': supabase.table('polos').select('id').eq('nome', data.get('polo_name')).execute().data[0]['id'],
                'unidade': data.get('unidade') or None,
                'senha': '12345678'  # Senha padrão para novos funcionários
            }

            # Remover campos que não devem ser inseridos se não fornecidos
            funcionario_data = {k: v for k, v in funcionario_data.items() if v is not None}
            print(f"Dados para inserção no Supabase: {funcionario_data}")

            # Inserir o funcionário no Supabase
            response = supabase.table('funcionarios').insert(funcionario_data).execute()
            if not response.data:
                print("Erro ao criar funcionário")
                return jsonify({'error': 'Erro ao criar funcionário'}), 500

            # Registrar log da criação
            log_action(
                user_id=user['id'],
                action_type='CREATE',
                entity_type='FUNCIONARIO',
                entity_id=response.data[0]['id'],
                details={'nome': data.get('nome'), 'cpf': data.get('cpf'), 'cargo': data.get('cargo')}
            )

            print(f"Funcionário criado com sucesso: {response.data}")
            return jsonify({'message': 'Funcionário criado com sucesso', 'funcionario': response.data[0]})
        except Exception as e:
            print(f"Erro em create_funcionario: {str(e)}")
            return jsonify({'error': str(e)}), 500

@app.route('/api/funcionarios/<id>', methods=['GET', 'PATCH', 'DELETE'])
def manage_funcionario(id):
    user = get_current_user()
    if not user:
        print("Erro: Usuário não autenticado em /api/funcionarios/<id>")
        return jsonify({'error': 'Unauthorized'}), 401

    if request.method == 'GET':
        try:
            # Apenas admin e secretaria podem acessar os detalhes de funcionários
            if user['cargo'] not in ['admin', 'secretaria']:
                print("Erro: Usuário não tem permissão para acessar esta rota")
                return jsonify({'error': 'Forbidden: Apenas admin ou secretaria podem acessar esta rota'}), 403

            # Buscar os detalhes do funcionário
            funcionario = execute_supabase_query(
                supabase.table('funcionarios')
                .select('id, nome, cpf, cargo, polo_id, polos!funcionarios_polo_id_fkey(nome), unidade, created_at')
                .eq('id', id)
                .single()
            )

            if not funcionario:
                print(f"Funcionário com ID {id} não encontrado")
                return jsonify({'error': 'Funcionário não encontrado'}), 404

            # Buscar os logs associados ao funcionário
            logs_query = supabase.table('logs').select(
                'id, action_type, entity_type, entity_id, details, created_at'
            ).eq('user_id', id).order('created_at', desc=True).limit(50)

            logs = execute_supabase_query(logs_query)
            print(f"Logs retornados para o funcionário {id}: {logs}")

            # Definir o fuso horário de São Paulo
            sao_paulo_tz = pytz.timezone('America/Sao_Paulo')

            # Capitalizar o cargo
            cargo = funcionario['cargo'].capitalize() if funcionario['cargo'] else 'Não especificado'

            # Formatar a data de criação para o padrão brasileiro
            created_at = 'Não especificado'
            if funcionario.get('created_at'):
                try:
                    # Converter a string de data para um objeto datetime
                    created_at_dt = datetime.fromisoformat(funcionario['created_at'].replace('Z', '+00:00'))
                    # Converter para o fuso horário de São Paulo
                    created_at_dt = created_at_dt.astimezone(sao_paulo_tz)
                    # Formatar a data no padrão brasileiro
                    created_at = created_at_dt.strftime('%d/%m/%Y %H:%M:%S')
                except Exception as e:
                    print(f"Erro ao formatar data de criação para {funcionario['id']}: {str(e)}")
                    created_at = 'Formato inválido'

            # Formatar os logs para o padrão brasileiro
            formatted_logs = []
            for log in logs:
                log_created_at = 'Não especificado'
                if log.get('created_at'):
                    try:
                        log_created_at_dt = datetime.fromisoformat(log['created_at'].replace('Z', '+00:00'))
                        log_created_at_dt = log_created_at_dt.astimezone(sao_paulo_tz)
                        log_created_at = log_created_at_dt.strftime('%d/%m/%Y %H:%M:%S')
                    except Exception as e:
                        print(f"Erro ao formatar data do log {log['id']}: {str(e)}")
                        log_created_at = 'Formato inválido'

                formatted_logs.append({
                    'id': log['id'],
                    'action_type': log['action_type'],
                    'entity_type': log['entity_type'],
                    'entity_id': log['entity_id'],
                    'details': log['details'],
                    'created_at': log_created_at
                })

            result = {
                'nome': funcionario['nome'],
                'cpf': funcionario['cpf'],
                'cargo': cargo,
                'polo_id': funcionario['polo_id'],
                'polo_nome': funcionario['polos']['nome'] if funcionario.get('polos') else 'Não especificado',
                'unidade': funcionario.get('unidade', 'Não especificado'),
                'created_at': created_at,
                'logs': formatted_logs
            }

            print(f"Detalhes do funcionário retornados: {result}")
            return jsonify(result)
        except Exception as e:
            print(f"Erro em get_funcionario_details: {str(e)}")
            return jsonify({'error': str(e)}), 500

    elif request.method == 'PATCH':
        try:
            # Apenas admin e secretaria podem atualizar funcionários
            if user['cargo'] not in ['admin', 'secretaria']:
                print("Erro: Usuário não tem permissão para acessar esta rota")
                return jsonify({'error': 'Forbidden: Apenas admin ou secretaria podem acessar esta rota'}), 403

            data = request.json
            print(f"Dados recebidos para atualização do funcionário {id}: {data}")

            # Buscar dados antigos para o log
            old_data = execute_supabase_query(
                supabase.table('funcionarios')
                .select('nome, cpf, cargo, polo_id, polos!funcionarios_polo_id_fkey(nome), unidade')
                .eq('id', id)
                .single()
            )

            # Preparar os dados para atualização
            update_data = {
                'nome': data.get('nome'),
                'cpf': data.get('cpf'),
                'cargo': data.get('cargo'),
                'polo_id': supabase.table('polos').select('id').eq('nome', data.get('polo_name')).execute().data[0]['id'],
                'unidade': data.get('unidade')
            }

            # Remover campos que não devem ser atualizados se não fornecidos
            update_data = {k: v for k, v in update_data.items() if v is not None}
            print(f"Dados para atualização no Supabase: {update_data}")

            # Atualizar o funcionário no Supabase
            response = supabase.table('funcionarios').update(update_data).eq('id', id).execute()
            if not response.data:
                print(f"Funcionário com ID {id} não encontrado")
                return jsonify({'error': 'Funcionário não encontrado'}), 404

            # Registrar log da atualização
            log_action(
                user_id=user['id'],
                action_type='UPDATE',
                entity_type='FUNCIONARIO',
                entity_id=id,
                details={
                    'old_data': {
                        'nome': old_data['nome'],
                        'cpf': old_data['cpf'],
                        'cargo': old_data['cargo'],
                        'polo_nome': old_data['polos']['nome'],
                        'unidade': old_data['unidade']
                    },
                    'new_data': update_data
                }
            )

            print(f"Funcionário com ID {id} atualizado com sucesso")
            return jsonify({'message': 'Funcionário atualizado com sucesso'})
        except Exception as e:
            print(f"Erro em update_funcionario: {str(e)}")
            return jsonify({'error': str(e)}), 500

    elif request.method == 'DELETE':
        try:
            # Apenas admin e secretaria podem excluir funcionários
            if user['cargo'] not in ['admin', 'secretaria']:
                print("Erro: Usuário não tem permissão para acessar esta rota")
                return jsonify({'error': 'Forbidden: Apenas admin ou secretaria podem acessar esta rota'}), 403

            # Buscar dados do funcionário para o log
            funcionario = execute_supabase_query(
                supabase.table('funcionarios')
                .select('id, nome, cpf, cargo, polo_id, polos!funcionarios_polo_id_fkey(nome), unidade')
                .eq('id', id)
                .single()
            )

            if not funcionario:
                print(f"Funcionário com ID {id} não encontrado")
                return jsonify({'error': 'Funcionário não encontrado'}), 404

            # Excluir o funcionário do Supabase
            response = supabase.table('funcionarios').delete().eq('id', id).execute()

            # Registrar log da exclusão
            log_action(
                user_id=user['id'],
                action_type='DELETE',
                entity_type='FUNCIONARIO',
                entity_id=id,
                details={
                    'nome': funcionario['nome'],
                    'cpf': funcionario['cpf'],
                    'cargo': funcionario['cargo'],
                    'polo_nome': funcionario['polos']['nome'],
                    'unidade': funcionario['unidade']
                }
            )

            print(f"Funcionário com ID {id} excluído com sucesso")
            return jsonify({'message': 'Funcionário excluído com sucesso'})
        except Exception as e:
            print(f"Erro em delete_funcionario: {str(e)}")
            return jsonify({'error': str(e)}), 500

@app.route('/api/polos', methods=['GET'])
def get_polos():
    user = get_current_user()
    if not user:
        print("Erro: Usuário não autenticado em /api/polos")
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        polos = execute_supabase_query(
            supabase.table('polos').select('id, nome')
        )
        result = [{'id': polo['id'], 'nome': polo['nome']} for polo in polos]
        print(f"Polos retornados: {result}")
        return jsonify(result)
    except Exception as e:
        print(f"Erro em get_polos: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/alunos', methods=['GET'])
def manage_alunos():
    user = get_current_user()
    if not user:
        print("Erro: Usuário não autenticado em /api/alunos")
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        count_only = request.args.get('count_only', 'false').lower() == 'true'

        nome = request.args.get('nome', '').strip()
        matricula = request.args.get('matricula', '').strip()
        polo_name = request.args.get('polo_name', '').strip()
        turma_unidade = request.args.get('turma_unidade', '').strip()
        genero = request.args.get('genero', '').strip()
        pcd = request.args.get('pcd', '').strip()
        unidade = request.args.get('unidade', '').strip()
        etapa = request.args.get('etapa', '').strip()
        status = request.args.get('status', '').strip()

        # Converter o valor do filtro etapa para o formato esperado no banco (ex.: "4" -> "4º Ano")
        if etapa and etapa.lower() != 'tudo':
            etapa = f"{etapa}º Ano"

        base_query = supabase.table('alunos').select('id', count='exact')

        if nome:
            base_query = base_query.ilike('nome', f'%{nome}%')
        if matricula:
            base_query = base_query.ilike('matricula', f'%{matricula}%')
        if polo_name and polo_name.lower() != 'tudo':
            base_query = base_query.eq('polo_id', (
                supabase.table('polos').select('id').eq('nome', polo_name).execute().data[0]['id']
            ))
        if turma_unidade and turma_unidade.lower() != 'tudo':
            base_query = base_query.ilike('turma_unidade', f'%{turma_unidade}%')
        if genero and genero.lower() != 'tudo':
            base_query = base_query.eq('genero', genero)
        if pcd and pcd.lower() != 'tudo':
            base_query = base_query.eq('pcd', 'Com Deficiência' if pcd.lower() == 'com deficiência' else 'Sem Deficiência')
        if unidade and unidade.lower() != 'tudo':
            base_query = base_query.ilike('unidade', f'%{unidade}%')
        if etapa and etapa.lower() != 'tudo':
            base_query = base_query.eq('etapa', etapa)
        if status and status.lower() != 'tudo':
            # Este filtro será tratado no lado do servidor, não no banco
            pass

        if count_only:
            total_response = base_query.execute()
            total_alunos = total_response.count
            return jsonify({'total_alunos': total_alunos})

        query = supabase.table('alunos').select(
            'id, nome, matricula, polo_id, polos(nome), turma_unidade, genero, pcd, unidade, etapa, turno, data_nascimento, matriculas(turmas(disciplinas(tipo), dia_semana))'
        )

        if nome:
            query = query.ilike('nome', f'%{nome}%')
        if matricula:
            query = query.ilike('matricula', f'%{matricula}%')
        if polo_name and polo_name.lower() != 'tudo':
            query = query.eq('polo_id', (
                supabase.table('polos').select('id').eq('nome', polo_name).execute().data[0]['id']
            ))
        if turma_unidade and turma_unidade.lower() != 'tudo':
            query = query.ilike('turma_unidade', f'%{turma_unidade}%')
        if genero and genero.lower() != 'tudo':
            query = query.eq('genero', genero)
        if pcd and pcd.lower() != 'tudo':
            query = query.eq('pcd', 'Com Deficiência' if pcd.lower() == 'com deficiência' else 'Sem Deficiência')
        if unidade and unidade.lower() != 'tudo':
            query = query.ilike('unidade', f'%{unidade}%')
        if etapa and etapa.lower() != 'tudo':
            query = query.eq('etapa', etapa)

        # Calcular o total de alunos que correspondem aos filtros
        total_response = base_query.execute()
        total_alunos = total_response.count

        # Carregar todos os alunos em lotes de 1000 (sem paginação)
        batch_size = 1000
        alunos = []
        for start in range(0, total_alunos, batch_size):
            end = min(start + batch_size - 1, total_alunos - 1)
            batch_query = query.range(start, end)
            batch_alunos = execute_supabase_query(batch_query)
            alunos.extend(batch_alunos)

        total_pages = 1

        result = []
        for aluno in alunos:
            matriculas = aluno.get('matriculas', [])
            # Contar matrículas por dia
            dias_matriculados = {}
            cognitive_count = 0
            motor_count = 0
            for m in matriculas:
                dia = m['turmas']['dia_semana']
                tipo = m['turmas']['disciplinas']['tipo']
                if dia not in dias_matriculados:
                    dias_matriculados[dia] = {'cognitiva': 0, 'motora': 0}
                if tipo == 'cognitiva':
                    dias_matriculados[dia]['cognitiva'] += 1
                    cognitive_count += 1
                elif tipo == 'motora':
                    dias_matriculados[dia]['motora'] += 1
                    motor_count += 1

            # Determinar o status
            dias_completos = sum(1 for dia, counts in dias_matriculados.items() if counts['cognitiva'] >= 1 and counts['motora'] >= 1)
            status = 'pending'
            if dias_completos == 2:  # Matriculado em 2 dias (4 matrículas: 2 cognitivas e 2 motoras)
                status = 'complete'
            elif dias_completos == 1:  # Matriculado em 1 dia (2 matrículas: 1 cognitiva e 1 motora)
                status = 'partial'

            # Aplicar filtro de status, se especificado
            if status.lower() != 'tudo' and status != status.lower():
                continue

            result.append({
                'id': aluno['id'],
                'name': aluno['nome'],
                'matricula': aluno['matricula'],
                'polo_name': aluno['polos']['nome'],
                'turma_unidade': aluno['turma_unidade'],
                'genero': aluno['genero'],
                'pcd': aluno['pcd'],
                'unidade': aluno['unidade'],
                'etapa': aluno['etapa'],
                'turno': aluno['turno'],
                'data_nascimento': aluno['data_nascimento'],
                'status': status
            })
        return jsonify({
            'data': result,
            'total_pages': total_pages,
            'current_page': 1,
            'total_alunos': len(result)  # Ajustado para refletir o número de alunos após o filtro de status
        })
    except Exception as e:
        print(f"Erro em get_alunos: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/alunos/polo_count', methods=['GET'])
def get_alunos_polo_count():
    user = get_current_user()
    if not user:
        print("Erro: Usuário não autenticado em /api/alunos/polo_count")
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        # Verificar se o usuário tem um polo associado
        if 'polo_id' not in user or not user['polo_id']:
            print("Erro: Usuário não tem polo_id associado")
            return jsonify({'error': 'Usuário não tem polo associado'}), 400

        # Buscar o número de alunos do polo do usuário
        base_query = supabase.table('alunos').select('id', count='exact').eq('polo_id', user['polo_id'])
        response = base_query.execute()
        total_alunos_polo = response.count

        print(f"Número de alunos no polo {user['polo_id']}: {total_alunos_polo}")
        return jsonify({'total_alunos_polo': total_alunos_polo})
    except Exception as e:
        print(f"Erro em get_alunos_polo_count: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/alunos/<id>', methods=['PATCH'])
def update_aluno(id):
    print(f"Requisição recebida para /api/alunos/{id} com método PATCH")
    user = get_current_user()
    if not user:
        print("Erro: Usuário não autenticado em /api/alunos/<id>")
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        data = request.json
        print(f"Dados recebidos para atualização de aluno: {data}")

        # Buscar dados antigos para o log
        old_data = execute_supabase_query(
            supabase.table('alunos')
            .select('nome, polo_id, polos(nome), unidade, genero, pcd, etapa, turno, data_nascimento')
            .eq('id', id)
            .single()
        )

        update_data = {
            'nome': data.get('name'),
            'polo_id': supabase.table('polos').select('id').eq('nome', data.get('polo_name')).execute().data[0]['id'],
            'unidade': data.get('unidade'),
            'genero': data.get('genero'),
            'pcd': data.get('pcd'),
            'etapa': data.get('etapa'),
            'turno': data.get('turno'),
            'data_nascimento': data.get('data_nascimento') or None
        }
        # Remover campos que não devem ser atualizados se não fornecidos
        update_data = {k: v for k, v in update_data.items() if v is not None}
        print(f"Dados para atualização no Supabase (aluno): {update_data}")

        response = supabase.table('alunos').update(update_data).eq('id', id).execute()
        if not response.data:
            print(f"Aluno com ID {id} não encontrado")
            return jsonify({'error': 'Aluno não encontrado'}), 404

        # Registrar log da atualização
        log_action(
            user_id=user['id'],
            action_type='UPDATE',
            entity_type='ALUNO',
            entity_id=id,
            details={
                'old_data': {
                    'nome': old_data['nome'],
                    'polo_nome': old_data['polos']['nome'],
                    'unidade': old_data['unidade'],
                    'genero': old_data['genero'],
                    'pcd': old_data['pcd'],
                    'etapa': old_data['etapa'],
                    'turno': old_data['turno'],
                    'data_nascimento': old_data['data_nascimento']
                },
                'new_data': update_data
            }
        )

        print(f"Aluno com ID {id} atualizado com sucesso")
        return jsonify({'message': 'Aluno atualizado com sucesso'})
    except Exception as e:
        print(f"Erro em update_aluno: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/alunos/<id>/unenroll', methods=['DELETE'])
def unenroll_aluno(id):
    print(f"Requisição recebida para /api/alunos/{id}/unenroll com método DELETE")
    user = get_current_user()
    if not user:
        print("Erro: Usuário não autenticado em /api/alunos/<id>/unenroll")
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        # Verificar se o aluno existe
        aluno = supabase.table('alunos').select('id, nome').eq('id', id).execute().data
        if not aluno:
            print(f"Aluno com ID {id} não encontrado")
            return jsonify({'error': 'Aluno não encontrado'}), 404

        # Remover todas as matrículas do aluno
        supabase.table('matriculas').delete().eq('aluno_id', id).execute()

        # Registrar log da desmatriculação
        log_action(
            user_id=user['id'],
            action_type='DELETE',
            entity_type='MATRICULA',
            entity_id=id,
            details={'aluno_nome': aluno[0]['nome']}
        )

        print(f"Aluno com ID {id} desenturmado com sucesso")
        return jsonify({'message': 'Aluno desenturmado com sucesso'})
    except Exception as e:
        print(f"Erro em unenroll_aluno: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/alunos_paginados', methods=['GET'])
def manage_alunos_paginados():
    user = get_current_user()
    if not user:
        print("Erro: Usuário não autenticado em /api/alunos_paginados")
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        count_only = request.args.get('count_only', 'false').lower() == 'true'
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 100))  # Padrão de 100 alunos por página

        nome = request.args.get('nome', '').strip()
        matricula = request.args.get('matricula', '').strip()
        polo_name = request.args.get('polo_name', '').strip()
        turma_unidade = request.args.get('turma_unidade', '').strip()
        genero = request.args.get('genero', '').strip()
        pcd = request.args.get('pcd', '').strip()
        unidade = request.args.get('unidade', '').strip()
        etapa = request.args.get('etapa', '').strip()
        status = request.args.get('status', '').strip()

        # Converter o valor do filtro etapa para o formato esperado no banco (ex.: "4" -> "4º Ano")
        if etapa and etapa.lower() != 'tudo':
            etapa = f"{etapa}º Ano"

        base_query = supabase.table('alunos').select('id', count='exact')

        # Aplicar restrição inicial com base no cargo do usuário
        if user['cargo'] in ['diretor', 'monitor']:
            # Filtrar apenas alunos da mesma unidade do usuário
            if user.get('unidade'):
                base_query = base_query.eq('unidade', user['unidade'])
            else:
                # Se o usuário não tiver unidade definida, não retorna alunos
                return jsonify({
                    'data': [],
                    'total_pages': 1,
                    'current_page': 1,
                    'total_alunos': 0
                })
        elif user['cargo'] == 'coordenador':
            # Filtrar apenas alunos do mesmo polo do usuário
            if user.get('polo_id'):
                base_query = base_query.eq('polo_id', user['polo_id'])
            else:
                # Se o usuário não tiver polo definido, não retorna alunos
                return jsonify({
                    'data': [],
                    'total_pages': 1,
                    'current_page': 1,
                    'total_alunos': 0
                })
        # Admin e secretaria veem todos os alunos, sem restrição adicional

        # Aplicar filtros adicionais da query string
        if nome:
            base_query = base_query.ilike('nome', f'%{nome}%')
        if matricula:
            base_query = base_query.ilike('matricula', f'%{matricula}%')
        if polo_name and polo_name.lower() != 'tudo':
            base_query = base_query.eq('polo_id', (
                supabase.table('polos').select('id').eq('nome', polo_name).execute().data[0]['id']
            ))
        if turma_unidade and turma_unidade.lower() != 'tudo':
            base_query = base_query.ilike('turma_unidade', f'%{turma_unidade}%')
        if genero and genero.lower() != 'tudo':
            base_query = base_query.eq('genero', genero)
        if pcd and pcd.lower() != 'tudo':
            base_query = base_query.eq('pcd', 'Com Deficiência' if pcd.lower() == 'com deficiência' else 'Sem Deficiência')
        if unidade and unidade.lower() != 'tudo':
            base_query = base_query.ilike('unidade', f'%{unidade}%')
        if etapa and etapa.lower() != 'tudo':
            base_query = base_query.eq('etapa', etapa)

        if count_only:
            total_response = base_query.execute()
            total_alunos = total_response.count
            return jsonify({'total_alunos': total_alunos})

        query = supabase.table('alunos').select(
            'id, nome, matricula, polo_id, polos(nome), turma_unidade, genero, pcd, unidade, etapa, turno, data_nascimento, matriculas(turmas(disciplinas(tipo), dia_semana))'
        )

        # Aplicar as mesmas restrições iniciais à query principal
        if user['cargo'] in ['diretor', 'monitor']:
            if user.get('unidade'):
                query = query.eq('unidade', user['unidade'])
            else:
                return jsonify({
                    'data': [],
                    'total_pages': 1,
                    'current_page': 1,
                    'total_alunos': 0
                })
        elif user['cargo'] == 'coordenador':
            if user.get('polo_id'):
                query = query.eq('polo_id', user['polo_id'])
            else:
                return jsonify({
                    'data': [],
                    'total_pages': 1,
                    'current_page': 1,
                    'total_alunos': 0
                })

        # Aplicar filtros adicionais da query string
        if nome:
            query = query.ilike('nome', f'%{nome}%')
        if matricula:
            query = query.ilike('matricula', f'%{matricula}%')
        if polo_name and polo_name.lower() != 'tudo':
            query = query.eq('polo_id', (
                supabase.table('polos').select('id').eq('nome', polo_name).execute().data[0]['id']
            ))
        if turma_unidade and turma_unidade.lower() != 'tudo':
            query = query.ilike('turma_unidade', f'%{turma_unidade}%')
        if genero and genero.lower() != 'tudo':
            query = query.eq('genero', genero)
        if pcd and pcd.lower() != 'tudo':
            query = query.eq('pcd', 'Com Deficiência' if pcd.lower() == 'com deficiência' else 'Sem Deficiência')
        if unidade and unidade.lower() != 'tudo':
            query = query.ilike('unidade', f'%{unidade}%')
        if etapa and etapa.lower() != 'tudo':
            query = query.eq('etapa', etapa)

        # Calcular o total de alunos que correspondem aos filtros
        total_response = base_query.execute()
        total_alunos = total_response.count

        # Carregar todos os alunos em lotes de 1000 para calcular o status
        batch_size = 1000
        alunos = []
        for start in range(0, total_alunos, batch_size):
            end = min(start + batch_size - 1, total_alunos - 1)
            batch_query = query.range(start, end)
            batch_alunos = execute_supabase_query(batch_query)
            alunos.extend(batch_alunos)

        total_pages = (total_alunos + per_page - 1) // per_page  # Arredonda para cima

        # Calcular o status de cada aluno
        result = []
        for aluno in alunos:
            matriculas = aluno.get('matriculas', [])
            # Contar matrículas por dia
            dias_matriculados = {}
            cognitive_count = 0
            motor_count = 0
            for m in matriculas:
                dia = m['turmas']['dia_semana']
                tipo = m['turmas']['disciplinas']['tipo']
                if dia not in dias_matriculados:
                    dias_matriculados[dia] = {'cognitiva': 0, 'motora': 0}
                if tipo == 'cognitiva':
                    dias_matriculados[dia]['cognitiva'] += 1
                    cognitive_count += 1
                elif tipo == 'motora':
                    dias_matriculados[dia]['motora'] += 1
                    motor_count += 1

            # Determinar o status
            dias_completos = sum(1 for dia, counts in dias_matriculados.items() if counts['cognitiva'] >= 1 and counts['motora'] >= 1)
            aluno_status = 'pending'
            if dias_completos == 2:  # Matriculado em 2 dias (4 matrículas: 2 cognitivas e 2 motoras)
                aluno_status = 'complete'
            elif dias_completos == 1:  # Matriculado em 1 dia (2 matrículas: 1 cognitiva e 1 motora)
                aluno_status = 'partial'

            # Aplicar filtro de status, se especificado
            if status and status.lower() != 'tudo' and aluno_status != status.lower():
                continue

            aluno_data = {
                'id': aluno['id'],
                'name': aluno['nome'],
                'matricula': aluno['matricula'],
                'polo_name': aluno['polos']['nome'],
                'turma_unidade': aluno['turma_unidade'],
                'genero': aluno['genero'],
                'pcd': aluno['pcd'],
                'unidade': aluno['unidade'],
                'etapa': aluno['etapa'],
                'turno': aluno['turno'],
                'data_nascimento': aluno['data_nascimento'],
                'status': aluno_status
            }
            result.append(aluno_data)

        # Aplicar paginação
        start = (page - 1) * per_page
        end = min(start + per_page, len(result))
        paginated_result = result[start:end]

        return jsonify({
            'data': paginated_result,
            'total_pages': total_pages,
            'current_page': page,
            'total_alunos': len(result)
        })
    except Exception as e:
        print(f"Erro em get_alunos_paginados: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/turmas', methods=['GET', 'POST'])
def get_turmas():
    user = get_current_user()
    if not user:
        print("Erro: Usuário não autenticado em /api/turmas")
        return jsonify({'error': 'Unauthorized'}), 401
    
    if request.method == 'GET':
        try:
            query = supabase.table('turmas').select(
                'id, nome, disciplinas(tipo), faixa_etaria, dia_semana, periodo, capacidade, matriculas(id), polo_id, polos!turmas_polo_id_fkey(nome)'
            )

            if user['cargo'] in ['admin', 'secretaria']:
                turmas = execute_supabase_query(query)
            elif user['cargo'] in ['monitor', 'diretor']:
                turmas = execute_supabase_query(query.eq('polo_id', user['polo_id']))
            else:
                turmas = execute_supabase_query(query.eq('polo_id', user['polo_id']))

            result = []
            for turma in turmas:
                polo_name = turma['polos']['nome'] if turma.get('polos') and turma['polos'].get('nome') else 'Não especificado'
                result.append({
                    'id': turma['id'],
                    'name': turma['nome'],
                    'subject': 'Cognitiva' if turma['disciplinas']['tipo'] == 'cognitiva' else 'Motora',
                    'type': turma['disciplinas']['tipo'],
                    'grades': turma['faixa_etaria'],
                    'day': turma['dia_semana'],
                    'period': turma['periodo'],
                    'capacity': turma['capacidade'],
                    'enrollmentCount': len(turma['matriculas']),
                    'polo_name': polo_name
                })
            return jsonify(result)
        except Exception as e:
            print(f"Erro em get_turmas: {str(e)}")
            return jsonify({'error': str(e)}), 500
    elif request.method == 'POST':
        print("Requisição recebida para /api/turmas com método POST")
        data = request.json
        print(f"Dados recebidos para criação de turma: {data}")
        try:
            # Verificar se disciplina_id foi fornecido
            if 'disciplina_id' not in data or not data['disciplina_id']:
                print("Erro: disciplina_id não fornecido")
                return jsonify({'error': 'disciplina_id é obrigatório'}), 400

            disciplina_id = data['disciplina_id']
            print(f"Disciplina ID recebida: {disciplina_id}")

            # Verificar se a disciplina existe
            disciplina = execute_supabase_query(
                supabase.table('disciplinas').select('id, nome, tipo').eq('id', disciplina_id).single()
            )
            if not disciplina:
                print(f"Disciplina com ID {disciplina_id} não encontrada")
                return jsonify({'error': f"Disciplina com ID {disciplina_id} não encontrada"}), 400

            tipo = disciplina['tipo']
            print(f"Tipo da disciplina: {tipo}")

            # Verificar se polo_id existe
            polo_query = supabase.table('polos').select('id').eq('nome', data['polo_name'])
            polo = execute_supabase_query(polo_query)
            if not polo:
                print(f"Polo com nome {data['polo_name']} não encontrado")
                return jsonify({'error': f"Polo com nome {data['polo_name']} não encontrado"}), 400
            polo_id = polo[0]['id']
            print(f"Polo ID encontrado: {polo_id}")

            # Inserir a nova turma no Supabase
            turma_data = {
                'nome': data['name'],
                'disciplina_id': disciplina_id,
                'faixa_etaria': data['grades'],
                'dia_semana': data['day'],
                'periodo': data['period'],
                'capacidade': int(data['capacity']),
                'polo_id': polo_id
            }
            print(f"Dados para inserção no Supabase: {turma_data}")
            turma = supabase.table('turmas').insert(turma_data).execute().data[0]
            print(f"Turma criada com sucesso: {turma}")

            # Registrar log da criação
            log_action(
                user_id=user['id'],
                action_type='CREATE',
                entity_type='TURMA',
                entity_id=turma['id'],
                details={
                    'nome': turma['nome'],
                    'disciplina_nome': disciplina['nome'],
                    'tipo': tipo,
                    'polo_nome': data['polo_name']
                }
            )

            return jsonify({
                'id': turma['id'],
                'name': turma['nome'],
                'type': tipo,
                'grades': turma['faixa_etaria'],
                'day': turma['dia_semana'],
                'period': turma['periodo'],
                'capacity': turma['capacidade'],
                'polo_name': data['polo_name']
            })
        except Exception as e:
            print(f"Erro em criar turma (POST): {str(e)}")
            return jsonify({'error': str(e)}), 500

@app.route('/api/turmas/<id>', methods=['PATCH', 'DELETE'])
def update_turma(id):
    print(f"Requisição recebida para /api/turmas/{id} com método {request.method}")
    user = get_current_user()
    if not user:
        print("Erro: Usuário não autenticado em /api/turmas/<id>")
        return jsonify({'error': 'Unauthorized'}), 401

    if request.method == 'PATCH':
        try:
            data = request.json
            print(f"Dados recebidos para atualização: {data}")

            # Buscar dados antigos para o log
            old_data = execute_supabase_query(
                supabase.table('turmas')
                .select('nome, faixa_etaria, dia_semana, periodo, capacidade, polos!turmas_polo_id_fkey(nome)')
                .eq('id', id)
                .single()
            )

            update_data = {
                'nome': data.get('name'),
                'faixa_etaria': data.get('grades'),  # Já é um array vindo do frontend
                'dia_semana': data.get('day'),
                'periodo': data.get('period'),
                'capacidade': int(data['capacity'])
            }

            # Remover campos que não devem ser atualizados se não fornecidos
            update_data = {k: v for k, v in update_data.items() if v is not None}
            print(f"Dados para atualização no Supabase: {update_data}")

            response = supabase.table('turmas').update(update_data).eq('id', id).execute()
            if not response.data:
                print(f"Turma com ID {id} não encontrada no Supabase")
                return jsonify({'error': 'Turma não encontrada'}), 404

            # Registrar log da atualização
            log_action(
                user_id=user['id'],
                action_type='UPDATE',
                entity_type='TURMA',
                entity_id=id,
                details={
                    'old_data': {
                        'nome': old_data['nome'],
                        'faixa_etaria': old_data['faixa_etaria'],
                        'dia_semana': old_data['dia_semana'],
                        'periodo': old_data['periodo'],
                        'capacidade': old_data['capacidade'],
                        'polo_nome': old_data['polos']['nome']
                    },
                    'new_data': update_data
                }
            )

            print(f"Turma com ID {id} atualizada com sucesso")
            return jsonify({'message': 'Turma atualizada com sucesso'})
        except Exception as e:
            print(f"Erro em update_turma: {str(e)}")
            return jsonify({'error': str(e)}), 500

    elif request.method == 'DELETE':
        try:
            # Buscar dados da turma para o log
            turma = execute_supabase_query(
                supabase.table('turmas')
                .select('id, nome, polos!turmas_polo_id_fkey(nome)')
                .eq('id', id)
                .single()
            )

            if not turma:
                print(f"Turma com ID {id} não encontrada")
                return jsonify({'error': 'Turma não encontrada'}), 404

            # Remover todas as matrículas da turma antes de excluí-la
            supabase.table('matriculas').delete().eq('turma_id', id).execute()

            # Excluir a turma do Supabase
            response = supabase.table('turmas').delete().eq('id', id).execute()

            # Registrar log da exclusão
            log_action(
                user_id=user['id'],
                action_type='DELETE',
                entity_type='TURMA',
                entity_id=id,
                details={
                    'turma_nome': turma['nome'],
                    'polo_nome': turma['polos']['nome']
                }
            )

            print(f"Turma com ID {id} excluída com sucesso")
            return jsonify({'message': 'Turma excluída com sucesso'})
        except Exception as e:
            print(f"Erro em delete_turma: {str(e)}")
            return jsonify({'error': str(e)}), 500

@app.route('/api/turmas/<id>/unenroll', methods=['DELETE'])
def unenroll_turma(id):
    print(f"Requisição recebida para /api/turmas/{id}/unenroll com método DELETE")
    user = get_current_user()
    if not user:
        print("Erro: Usuário não autenticado em /api/turmas/<id>/unenroll")
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        # Verificar se a turma existe
        turma = supabase.table('turmas').select('id, nome, polos!turmas_polo_id_fkey(nome)').eq('id', id).execute().data
        if not turma:
            print(f"Turma com ID {id} não encontrada")
            return jsonify({'error': 'Turma não encontrada'}), 404

        # Remover todas as matrículas da turma
        supabase.table('matriculas').delete().eq('turma_id', id).execute()

        # Registrar log da desmatriculação
        log_action(
            user_id=user['id'],
            action_type='DELETE',
            entity_type='MATRICULA',
            entity_id=id,
            details={
                'turma_nome': turma[0]['nome'],
                'polo_nome': turma[0]['polos']['nome']
            }
        )

        print(f"Alunos desmatriculados da turma com ID {id}")
        return jsonify({'message': 'Alunos desmatriculados com sucesso'})
    except Exception as e:
        print(f"Erro em unenroll_turma: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/turmas_ativas', methods=['GET'])
def get_turmas_ativas():
    user = get_current_user()
    if not user:
        print("Erro: Usuário não autenticado em /api/turmas_ativas")
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        # Determinar o turno e dia da semana atuais com base no horário
        sao_paulo_tz = pytz.timezone('America/Sao_Paulo')
        current_time = datetime.now(sao_paulo_tz)
        current_hour = current_time.hour
        current_period = 'manha' if 6 <= current_hour <= 12 else 'tarde'

        # Mapear o dia da semana atual para o formato do banco (seg, ter, qua, qui, sex)
        weekday_map = {
            0: 'seg',  # Segunda
            1: 'ter',  # Terça
            2: 'qua',  # Quarta
            3: 'qui',  # Quinta
            4: 'sex',  # Sexta
        }
        current_weekday = weekday_map.get(current_time.weekday())
        if not current_weekday:
            print("Hoje não é um dia letivo (sábado ou domingo)")
            return jsonify({
                'current_period': current_period,
                'current_day': None,
                'turmas': []
            })

        print(f"Buscando turmas ativas para o turno: {current_period}, dia: {current_weekday}")

        # Consulta para turmas ativas no turno e dia atuais
        query = supabase.table('turmas').select(
            'id, nome, disciplinas(tipo), faixa_etaria, dia_semana, periodo, capacidade, matriculas(id, aluno_id, alunos(nome, unidade)), polo_id, polos!turmas_polo_id_fkey(nome)'
        ).eq('periodo', current_period).eq('dia_semana', current_weekday)

        # Filtrar com base no cargo do usuário
        if user['cargo'] in ['admin', 'secretaria']:
            turmas = execute_supabase_query(query)
        elif user['cargo'] in ['monitor', 'diretor', 'coordenador']:
            turmas = execute_supabase_query(query.eq('polo_id', user['polo_id']))
        else:
            turmas = []

        print(f"Turmas encontradas: {len(turmas)}")

        # Filtrar turmas com alunos matriculados (enrollmentCount > 0)
        result = []
        for turma in turmas:
            matriculas = turma.get('matriculas', [])
            enrollment_count = len(matriculas)
            if enrollment_count == 0:
                continue  # Ignora turmas sem alunos matriculados
            polo_name = turma['polos']['nome'] if turma.get('polos') else 'Não especificado'
            alunos = [
                {'id': m['aluno_id'], 'name': m['alunos']['nome'], 'unidade': m['alunos'].get('unidade', 'Não especificado')}
                for m in matriculas if m.get('alunos') and m['alunos'].get('nome')
            ]
            result.append({
                'id': turma['id'],
                'name': turma['nome'],
                'subject': 'Cognitiva' if turma['disciplinas']['tipo'] == 'cognitiva' else 'Motora',
                'type': turma['disciplinas']['tipo'],
                'grades': turma['faixa_etaria'],
                'day': turma['dia_semana'],
                'period': turma['periodo'],
                'capacity': turma['capacidade'],
                'enrollmentCount': enrollment_count,
                'polo_name': polo_name,
                'students': alunos
            })

        print(f"Turmas ativas com alunos matriculados: {len(result)}")

        return jsonify({
            'current_period': current_period,
            'current_day': current_weekday,
            'turmas': result
        })
    except Exception as e:
        print(f"Erro em get_turmas_ativas: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/matriculas', methods=['GET', 'POST'])
def manage_matriculas():
    user = get_current_user()
    if not user:
        print("Erro: Usuário não autenticado em /api/matriculas")
        return jsonify({'error': 'Unauthorized'}), 401
    if request.method == 'GET':
        try:
            matriculas = execute_supabase_query(
                supabase.table('matriculas').select('id, aluno_id, turma_id, turmas!left(disciplinas(tipo))')
            )
            result = []
            for matricula in matriculas:
                try:
                    turma = matricula.get('turmas', {})
                    disciplina = turma.get('disciplinas', {}) if turma else {}
                    tipo = disciplina.get('tipo', None) if disciplina else None
                    required = tipo == 'cognitiva' if tipo else False
                    result.append({
                        'id': matricula['id'],
                        'studentId': matricula['aluno_id'],
                        'classId': matricula['turma_id'],
                        'required': required
                    })
                except Exception as e:
                    print(f"Erro ao processar matrícula {matricula['id']}: {str(e)}")
                    result.append({
                        'id': matricula['id'],
                        'studentId': matricula['aluno_id'],
                        'classId': matricula['turma_id'],
                        'required': False
                    })
            return jsonify(result)
        except Exception as e:
            print(f"Erro em manage_matriculas GET: {str(e)}")
            return jsonify({'error': str(e)}), 500
    elif request.method == 'POST':
        data = request.json
        try:
            matricula = execute_supabase_query(
                supabase.table('matriculas').insert({
                    'aluno_id': data['alunoId'],
                    'turma_id': data['turmaId']
                })
            )[0]
            print(f"Nova matrícula criada: {matricula}")

            # Buscar detalhes para o log
            aluno = execute_supabase_query(
                supabase.table('alunos').select('nome').eq('id', data['alunoId']).single()
            )
            turma = execute_supabase_query(
                supabase.table('turmas').select('nome, polos!turmas_polo_id_fkey(nome)').eq('id', data['turmaId']).single()
            )

            # Registrar log da criação da matrícula
            log_action(
                user_id=user['id'],
                action_type='CREATE',
                entity_type='MATRICULA',
                entity_id=matricula['id'],
                details={
                    'aluno_nome': aluno['nome'],
                    'turma_nome': turma['nome'],
                    'polo_nome': turma['polos']['nome']
                }
            )

            return jsonify({
                'id': matricula['id'],
                'studentId': matricula['aluno_id'],
                'classId': matricula['turma_id']
            })
        except Exception as e:
            print(f"Erro em manage_matriculas POST: {str(e)}")
            return jsonify({'error': str(e)}), 500

@app.route('/enrollment')
def enrollment():
    user = get_current_user()
    if not user:
        print("Nenhum usuário autenticado em /enrollment, redirecionando para login")
        return redirect(url_for('login'))
    print(f"Usuário autenticado em /enrollment: {user['id']}")
    return render_template('enrollment.html', user=user)

@app.route('/api/matriculas/<id>', methods=['DELETE'])
def delete_matricula(id):
    user = get_current_user()
    if not user:
        print("Erro: Usuário não autenticado em /api/matriculas/<id>")
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        matricula = supabase.table('matriculas').select('id, turma_id, turmas(polo_id)').eq('id', id).single().execute().data
        if not matricula:
            return jsonify({'error': 'Matrícula não encontrada'}), 404

        if user['cargo'] not in ['admin', 'secretaria']:
            if matricula['turmas']['polo_id'] != user['polo_id']:
                return jsonify({'error': 'Forbidden: Você não tem permissão para remover matrículas deste polo'}), 403

        # Buscar detalhes para o log
        matricula_details = execute_supabase_query(
            supabase.table('matriculas')
            .select('aluno_id, alunos(nome), turma_id, turmas(nome, polos!turmas_polo_id_fkey(nome))')
            .eq('id', id)
            .single()
        )

        supabase.table('matriculas').delete().eq('id', id).execute()

        # Registrar log da exclusão da matrícula
        log_action(
            user_id=user['id'],
            action_type='DELETE',
            entity_type='MATRICULA',
            entity_id=id,
            details={
                'aluno_nome': matricula_details['alunos']['nome'],
                'turma_nome': matricula_details['turmas']['nome'],
                'polo_nome': matricula_details['turmas']['polos']['nome']
            }
        )

        return jsonify({'message': 'Matrícula removida com sucesso'})
    except Exception as e:
        print(f"Erro em delete_matricula: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/logs', methods=['GET'])
def get_logs():
    user = get_current_user()
    if not user:
        print("Erro: Usuário não autenticado em /api/logs")
        return jsonify({'error': 'Unauthorized'}), 401

    if user['cargo'] not in ['admin', 'secretaria']:
        print("Erro: Usuário não tem permissão para acessar os logs")
        return jsonify({'error': 'Forbidden: Apenas admin ou secretaria podem acessar os logs'}), 403

    try:
        # Buscar logs com informações do usuário
        query = supabase.table('logs').select('*, funcionarios(nome, cargo)').order('created_at', desc=True)

        # Filtros
        user_id = request.args.get('user_id', '').strip()
        action_type = request.args.get('action_type', '').strip()
        entity_type = request.args.get('entity_type', '').strip()

        if user_id:
            query = query.eq('user_id', user_id)
        if action_type:
            query = query.eq('action_type', action_type)
        if entity_type:
            query = query.eq('entity_type', entity_type)

        logs = execute_supabase_query(query)

        # Definir o fuso horário de São Paulo
        sao_paulo_tz = pytz.timezone('America/Sao_Paulo')

        result = []
        for log in logs:
            created_at = 'Não especificado'
            if log.get('created_at'):
                try:
                    created_at_dt = datetime.fromisoformat(log['created_at'].replace('Z', '+00:00'))
                    created_at_dt = created_at_dt.astimezone(sao_paulo_tz)
                    created_at = created_at_dt.strftime('%d/%m/%Y %H:%M:%S')
                except Exception as e:
                    print(f"Erro ao formatar data de criação para log {log['id']}: {str(e)}")
                    created_at = 'Formato inválido'

            result.append({
                'id': log['id'],
                'user_id': log['user_id'],
                'user_name': log['funcionarios']['nome'],
                'user_cargo': log['funcionarios']['cargo'].capitalize(),
                'action_type': log['action_type'],
                'entity_type': log['entity_type'],
                'entity_id': log['entity_id'],
                'details': log['details'],
                'created_at': created_at
            })

        print(f"Logs retornados: {result}")
        return jsonify(result)
    except Exception as e:
        print(f"Erro em get_logs: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/disciplinas', methods=['GET'])
def get_disciplinas():
    user = get_current_user()
    if not user:
        print("Erro: Usuário não autenticado em /api/disciplinas")
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        disciplinas = execute_supabase_query(
            supabase.table('disciplinas').select('id, nome, tipo')
        )
        result = [{'id': disciplina['id'], 'nome': disciplina['nome'], 'tipo': disciplina['tipo']} for disciplina in disciplinas]
        print(f"Disciplinas retornadas: {result}")
        return jsonify(result)
    except Exception as e:
        print(f"Erro em get_disciplinas: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)