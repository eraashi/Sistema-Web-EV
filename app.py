from flask import Flask, request, jsonify, render_template, session, redirect, url_for
from supabase import create_client
from dotenv import load_dotenv
import os
from retrying import retry
from datetime import datetime
import pytz
import redis
import json
import logging
import httpx
from unidecode import unidecode

app = Flask(__name__)
load_dotenv()
app.secret_key = os.getenv('FLASK_SECRET_KEY')

# Configuração de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuração da sessão
app.config['SESSION_TYPE'] = 'redis'
app.config['SESSION_PERMANENT'] = True
app.config['PERMANENT_SESSION_LIFETIME'] = 3600
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_REDIS'] = redis.Redis.from_url(
    os.getenv('REDIS_URL', 'redis://localhost:6379'),
    decode_responses=True,
    socket_timeout=5,
    socket_connect_timeout=5,
)

# Configuração do Supabase
supabase = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_ANON_KEY'))

# Configuração do Redis
redis_client = redis.Redis.from_url(
    os.getenv('REDIS_URL', 'redis://localhost:6379'),
    decode_responses=True,
    socket_timeout=5,
    socket_connect_timeout=5,
)

# Testar conexão ao Redis na inicialização
try:
    redis_client.ping()
    logger.info('Conexão com Redis bem-sucedida')
except redis.RedisError as e:
    logger.error(f'Erro ao conectar ao Redis: {str(e)}')

@app.route('/test_redis')
def test_redis():
    logger.info('Acessando rota /test_redis')
    try:
        redis_client.set('test_key', 'Hello from Render')
        value = redis_client.get('test_key')
        logger.info(f'Valor obtido do Redis: {value}')
        return f'Redis value: {value}'
    except Exception as e:
        logger.error(f'Erro no Redis: {str(e)}')
        return f'Erro no Redis: {str(e)}', 500

@retry(stop_max_attempt_number=3, wait_fixed=1000)  # 3 tentativas, espera de 1 segundo entre tentativas
def execute_supabase_query(query):
    try:
        # Usar httpx com timeout explícito
        with httpx.Client(timeout=10.0) as client:  # Timeout de 30 segundos por requisição
            response = query.execute()
            if response.data is None:
                logger.warning("Nenhum dado retornado pela query do Supabase")
                return []
            return response.data
    except httpx.TimeoutException as te:
        logger.error(f"Timeout ao executar query no Supabase: {str(te)}")
        raise  # Levanta a exceção para retry
    except Exception as e:
        logger.error(f"Erro na query do Supabase: {str(e)}")
        raise  # Levanta a exceção para retry

def get_current_user():
    user_id = session.get('user_id')
    print(f"Verificando usuário na sessão: {user_id}")
    if not user_id:
        print("Nenhum user_id encontrado na sessão")
        return None
    try:
        funcionarios = execute_supabase_query(
            supabase.table('funcionarios').select('*, polos(nome)').eq('id', user_id)
        )
        if not funcionarios:
            print(f"Funcionário não encontrado para user_id: {user_id}")
            return None
        if len(funcionarios) > 1:
            print(f"Erro: Múltiplos funcionários encontrados para user_id: {user_id}")
            return None
        return funcionarios[0]
    except Exception as e:
        print(f"Erro em get_current_user para user_id {user_id}: {str(e)}")
        return None

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
    except Exception as e:
        print(f"Erro ao registrar log: {str(e)}")

def invalidate_turmas_ativas_cache():
    try:
        cursor = 0
        while True:
            cursor, keys = redis_client.scan(cursor=cursor, match='turmas:*', count=100)
            if keys:
                redis_client.delete(*keys)
                print(f"Cache de turmas limpo: {keys}")
            if cursor == 0:
                break
        cursor = 0
        while True:
            cursor, keys = redis_client.scan(cursor=cursor, match='dashboard_data:*', count=100)
            if keys:
                redis_client.delete(*keys)
                print(f"Cache de dashboard_data limpo: {keys}")
            if cursor == 0:
                break
        cursor = 0
        while True:
            cursor, keys = redis_client.scan(cursor=cursor, match='turmas_ativas:*', count=100)
            if keys:
                redis_client.delete(*keys)
                print(f"Cache de turmas_ativas limpo: {keys}")
            if cursor == 0:
                break
    except Exception as e:
        print(f"Erro ao invalidar caches: {str(e)}")

def invalidate_salas_cache():
    try:
        cursor = 0
        while True:
            cursor, keys = redis_client.scan(cursor=cursor, match='salas:*', count=100)
            if keys:
                redis_client.delete(*keys)
                print(f"Cache de salas limpo: {keys}")
            if cursor == 0:
                break
    except Exception as e:
        print(f"Erro ao invalidar caches de salas: {str(e)}")

@app.route('/salas')
def salas():
    user = get_current_user()
    if not user:
        print("Nenhum usuário autenticado em /salas, redirecionando para login")
        return redirect(url_for('login'))
    print(f"Usuário autenticado em /salas: {user['id']}")
    return render_template('salas.html', user=user)

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

    # Inicializar variáveis para o polo e unidades
    polo_data = {'nome': '', 'unidades': []}
    
    # Se o usuário for um coordenador, buscar as unidades do polo dele
    if user['cargo'] == 'coordenador' and user.get('polo_id'):
        try:
            polo_query = supabase.table('polos').select('nome, unidades').eq('id', user['polo_id']).single()
            polo_result = execute_supabase_query(polo_query)
            if polo_result and 'unidades' in polo_result and polo_result['unidades']:
                polo_data = {
                    'nome': polo_result['nome'],
                    'unidades': [unidade for unidade in polo_result['unidades'] if isinstance(unidade, str)]
                }
                print(f"Unidades encontradas para o polo {user['polo_id']} ({polo_data['nome']}): {polo_data['unidades']}")
            else:
                print(f"Nenhuma unidade encontrada para o polo {user['polo_id']}")
        except Exception as e:
            print(f"Erro ao buscar unidades do polo {user['polo_id']}: {str(e)}")
    
    # Renderizar o template passando o user e os dados do polo
    return render_template('student_list.html', user=user, polo_data=polo_data)

@app.route('/reports')
def reports():
    user = get_current_user()
    if not user:
        print("Nenhum usuário autenticado em /reports, redirecionando para login")
        return redirect(url_for('login'))
    print(f"Usuário autenticado em /reports: {user['id']}")
    return render_template('reports.html', user=user)

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

@app.route('/reports_busca_ativa')
def reports_busca_ativa():
    user = get_current_user()
    if not user:
        print("Nenhum usuário autenticado em /reports_busca_ativa, redirecionando para login")
        return redirect(url_for('login'))
    print(f"Usuário autenticado em /reports_busca_ativa: {user['id']}")
    return render_template('reports_busca_ativa.html', user=user)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        data = request.json
        cpf = data.get('cpf', '').strip()
        password = data.get('password', '').strip()

        # Limpar o CPF para conter apenas números
        cpf_cleaned = ''.join(filter(str.isdigit, cpf))
        print(f"Tentativa de login com CPF (limpo): {cpf_cleaned}, CPF original: {cpf}")

        try:
            # Aumentar retentativas e timeout
            funcionarios = execute_supabase_query(
                supabase.table('funcionarios').select('*').eq('cpf', cpf_cleaned).eq('senha', password)
            )
            print(f"Resultado da query para CPF {cpf_cleaned}: {funcionarios}")

            if not funcionarios or len(funcionarios) == 0:
                print("Funcionário não encontrado ou senha incorreta")
                return jsonify({'error': 'Credenciais de login inválidas'}), 401
            if len(funcionarios) > 1:
                print(f"Erro: Múltiplos funcionários encontrados para o CPF {cpf_cleaned}")
                return jsonify({'error': 'Múltiplos usuários encontrados'}), 400

            funcionario = funcionarios[0]
            print(f"Funcionário autenticado: {funcionario['id']}, Cargo: {funcionario['cargo']}")
            session['user_id'] = funcionario['id']
            print(f"Sessão atualizada: {session}")

            log_action(
                user_id=funcionario['id'],
                action_type='LOGIN',
                entity_type='USER',
                details={'cpf': cpf_cleaned}
            )
            return jsonify({'user': funcionario, 'redirect': url_for('dashboard')})
        except Exception as e:
            print(f"Erro no login para CPF {cpf_cleaned}: {str(e)}")
            return jsonify({'error': 'Erro interno ao processar login. Tente novamente.'}), 500
    return render_template('login.html')

@app.route('/logout', methods=['POST'])
def logout():
    user = get_current_user()
    if user:
        log_action(
            user_id=user['id'],
            action_type='LOGOUT',
            entity_type='USER',
            details={'cpf': user['cpf']}
        )
    session.pop('user_id', None)
    print("Usuário deslogado, sessão limpa")
    return jsonify({'message': 'Logout realizado com sucesso'})

@app.route('/api/presencas', methods=['GET'])
def get_presencas():
    user = get_current_user()
    if not user:
        print("Erro: Usuário não autenticado em /api/presencas")
        return jsonify({'error': 'Não autorizado'}), 401

    # Gerar chave de cache
    cache_key = f"presencas:{user['id']}:{user['cargo']}"
    cached_data = redis_client.get(cache_key)
    if cached_data:
        print(f"Cache hit para presencas: {cache_key}, tamanho: {len(cached_data)} bytes")
        return jsonify(json.loads(cached_data))

    try:
        # Adicionar log para verificar o usuário e seu polo_id
        print(f"Usuário: {user['id']}, Cargo: {user['cargo']}, Polo ID: {user.get('polo_id')}")

        query = supabase.from_('presenca').select(
            'id, id_aluno, matricula, nome_aluno, unidade, etapa, turno_escola_viva, presenca, data_escaneamento, hora_escaneamento, turma_id, turmas!turma_id(nome, faixa_etaria, polo_id, polos!turmas_polo_id_fkey(nome))'
        )

        if user['cargo'] in ['admin', 'secretaria']:
            print("Usuário admin ou secretaria: retornando todas as presenças")
            presencas = execute_supabase_query(query)
        elif user['cargo'] in ['monitor', 'diretor', 'coordenador']:
            if 'polo_id' not in user or not user['polo_id']:
                print("Erro: Usuário sem polo_id definido")
                return jsonify({'error': 'Usuário não tem polo associado'}), 400
            print(f"Filtrando presenças para o polo_id do usuário: {user['polo_id']}")
            # Adicionar log para a query
            print(f"Executando query para presenças com polo_id: {user['polo_id']}")
            presencas = execute_supabase_query(
                query.match({'turmas.polo_id': user['polo_id']})
            )
        else:
            print("Usuário sem permissão para visualizar presenças")
            presencas = []

        # Adicionar log para verificar o resultado da query
        print(f"Total de presenças encontradas: {len(presencas)}")
        if not presencas:
            print("Nenhuma presença encontrada para o polo do usuário")
            # Retornar lista vazia em vez de erro
            response_data = []
            redis_client.setex(cache_key, 300, json.dumps(response_data))
            return jsonify(response_data)

        result = []
        for presenca in presencas:
            try:
                turma = presenca.get('turmas', {})
                polo = turma.get('polos', {}) if turma else {}

                # Adicionar log para verificar os dados da presença
                print(f"Processando presença ID {presenca['id']}: Turma ID {presenca['turma_id']}, Polo ID {turma.get('polo_id')}")

                if user['cargo'] in ['monitor', 'diretor', 'coordenador']:
                    turma_polo_id = turma.get('polo_id')
                    if turma_polo_id != user['polo_id']:
                        print(f"Presença ID {presenca['id']} ignorada: polo_id {turma_polo_id} não corresponde ao polo do usuário {user['polo_id']}")
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
            except Exception as e:
                print(f"Erro ao processar presença ID {presenca['id']}: {str(e)}")
                continue

        # Adicionar log para o resultado final
        print(f"Total de presenças após processamento: {len(result)}")

        # Armazenar no cache por 5 minutos
        redis_client.setex(cache_key, 300, json.dumps(result))
        return jsonify(result)
    except Exception as e:
        print(f"Erro em get_presencas: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/ocorrencias', methods=['GET'])
def get_ocorrencias():
    user = get_current_user()
    if not user:
        print("Erro: Usuário não autenticado em /api/ocorrencias")
        return jsonify({'error': 'Não autorizado'}), 401

    # Gerar chave de cache
    cache_key = f"ocorrencias:{user['id']}:{user['cargo']}"
    cached_data = redis_client.get(cache_key)
    if cached_data:
        print(f"Cache hit para ocorrencias: {cache_key}, tamanho: {len(cached_data)} bytes")
        return jsonify(json.loads(cached_data))

    try:
        # Adicionar log para verificar o usuário e seu polo_id
        print(f"Usuário: {user['id']}, Cargo: {user['cargo']}, Polo ID: {user.get('polo_id')}")

        query = supabase.table('ocorrencias').select(
            'id, turma_id, ocorrencia, data_escaneamento, turmas!turma_id(nome, faixa_etaria, periodo, polo_id, polos!turmas_polo_id_fkey(nome))'
        )

        if user['cargo'] in ['admin', 'secretaria']:
            print("Usuário admin ou secretaria: retornando todas as ocorrências")
            ocorrencias = execute_supabase_query(query)
        elif user['cargo'] in ['monitor', 'diretor', 'coordenador']:
            if 'polo_id' not in user or not user['polo_id']:
                print("Erro: Usuário sem polo_id definido")
                return jsonify({'error': 'Usuário não tem polo associado'}), 400
            print(f"Filtrando ocorrências para o polo_id do usuário: {user['polo_id']}")
            # Adicionar log para a query
            print(f"Executando query para ocorrências com polo_id: {user['polo_id']}")
            ocorrencias = execute_supabase_query(
                query.match({'turmas.polo_id': user['polo_id']})
            )
        else:
            print("Usuário sem permissão para visualizar ocorrências")
            ocorrencias = []

        # Adicionar log para verificar o resultado da query
        print(f"Total de ocorrências encontradas: {len(ocorrencias)}")
        if not ocorrencias:
            print("Nenhuma ocorrência encontrada para o polo do usuário")
            # Retornar lista vazia em vez de erro
            response_data = []
            redis_client.setex(cache_key, 300, json.dumps(response_data))
            return jsonify(response_data)

        result = []
        for ocorrencia in ocorrencias:
            try:
                turma = ocorrencia.get('turmas', {})
                polo = turma.get('polos', {}) if turma else {}

                # Adicionar log para verificar os dados da ocorrência
                print(f"Processando ocorrência ID {ocorrencia['id']}: Turma ID {ocorrencia['turma_id']}, Polo ID {turma.get('polo_id')}")

                if user['cargo'] in ['monitor', 'diretor', 'coordenador']:
                    turma_polo_id = turma.get('polo_id')
                    if turma_polo_id != user['polo_id']:
                        print(f"Ocorrência ID {ocorrencia['id']} ignorada: polo_id {turma_polo_id} não corresponde ao polo do usuário {user['polo_id']}")
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
            except Exception as e:
                print(f"Erro ao processar ocorrência ID {ocorrencia['id']}: {str(e)}")
                continue

        # Adicionar log para o resultado final
        print(f"Total de ocorrências após processamento: {len(result)}")

        # Armazenar no cache por 5 minutos
        redis_client.setex(cache_key, 300, json.dumps(result))
        return jsonify(result)
    except Exception as e:
        print(f"Erro em get_ocorrencias: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/funcionarios', methods=['GET', 'POST'])
def manage_funcionarios():
    user = get_current_user()
    if not user:
        print("Erro: Usuário não autenticado em /api/funcionarios")
        return jsonify({'error': 'Não autorizado'}), 401

    # Gerar chave de cache para GET
    if request.method == 'GET':
        nome = request.args.get('nome', '').strip()
        cargo = request.args.get('cargo', '').strip()
        polo = request.args.get('polo', '').strip()
        cache_key = f"funcionarios:{user['id']}:{nome}:{cargo}:{polo}"
        cached_data = redis_client.get(cache_key)
        if cached_data:
            print(f"Cache hit para funcionarios: {cache_key}, tamanho: {len(cached_data)} bytes")
            return jsonify(json.loads(cached_data))

    if request.method == 'GET':
        try:
            if user['cargo'] not in ['admin', 'secretaria']:
                print("Erro: Usuário não tem permissão para acessar esta rota")
                return jsonify({'error': 'Proibido: Apenas admin ou secretaria podem acessar esta rota'}), 403

            query = supabase.table('funcionarios').select('id, nome, cpf, cargo, polo_id, polos!funcionarios_polo_id_fkey(nome), unidade, created_at')
            query = query.not_.in_('cargo', ['admin', 'secretaria'])

            if nome:
                query = query.ilike('nome', f'%{nome}%')
            if cargo and cargo != 'tudo':
                query = query.eq('cargo', cargo)
            if polo and polo != 'tudo':
                query = query.eq('polo_id', (
                    supabase.table('polos').select('id').eq('nome', polo).execute().data[0]['id']
                ))

            funcionarios = execute_supabase_query(query)

            sao_paulo_tz = pytz.timezone('America/Sao_Paulo')

            result = []
            for funcionario in funcionarios:
                cargo = funcionario['cargo'].capitalize() if funcionario['cargo'] else 'Não especificado'
                created_at = 'Não especificado'
                if funcionario.get('created_at'):
                    try:
                        created_at_dt = datetime.fromisoformat(funcionario['created_at'].replace('Z', '+00:00'))
                        created_at_dt = created_at_dt.astimezone(sao_paulo_tz)
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

            # Armazenar no cache por 5 minutos
            redis_client.setex(cache_key, 300, json.dumps(result))
            return jsonify(result)
        except Exception as e:
            print(f"Erro em get_funcionarios: {str(e)}")
            return jsonify({'error': str(e)}), 500

    elif request.method == 'POST':
        try:
            if user['cargo'] not in ['admin', 'secretaria']:
                print("Erro: Usuário não tem permissão para acessar esta rota")
                return jsonify({'error': 'Proibido: Apenas admin ou secretaria podem acessar esta rota'}), 403

            data = request.json
            print(f"Dados recebidos para criação de funcionário: {data}")

            funcionario_data = {
                'nome': data.get('nome'),
                'cpf': data.get('cpf'),
                'cargo': data.get('cargo'),
                'polo_id': supabase.table('polos').select('id').eq('nome', data.get('polo_name')).execute().data[0]['id'],
                'unidade': data.get('unidade') or None,
                'senha': '12345678'
            }

            funcionario_data = {k: v for k, v in funcionario_data.items() if v is not None}
            print(f"Dados para inserção no Supabase: {funcionario_data}")

            response = supabase.table('funcionarios').insert(funcionario_data).execute()
            if not response.data:
                print("Erro ao criar funcionário")
                return jsonify({'error': 'Erro ao criar funcionário'}), 500

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
        return jsonify({'error': 'Não autorizado'}), 401

    # Gerar chave de cache para GET
    if request.method == 'GET':
        cache_key = f"funcionario:{user['id']}:{id}"
        cached_data = redis_client.get(cache_key)
        if cached_data:
            print(f"Cache hit para funcionario: {cache_key}, tamanho: {len(cached_data)} bytes")
            return jsonify(json.loads(cached_data))

    if request.method == 'GET':
        try:
            if user['cargo'] not in ['admin', 'secretaria']:
                print("Erro: Usuário não tem permissão para acessar esta rota")
                return jsonify({'error': 'Proibido: Apenas admin ou secretaria podem acessar esta rota'}), 403

            funcionario = execute_supabase_query(
                supabase.table('funcionarios')
                .select('id, nome, cpf, cargo, polo_id, polos!funcionarios_polo_id_fkey(nome), unidade, created_at')
                .eq('id', id)
                .single()
            )

            if not funcionario:
                print(f"Funcionário com ID {id} não encontrado")
                return jsonify({'error': 'Funcionário não encontrado'}), 404

            logs_query = supabase.table('logs').select(
                'id, action_type, entity_type, entity_id, details, created_at'
            ).eq('user_id', id).order('created_at', desc=True).limit(50)

            logs = execute_supabase_query(logs_query)

            sao_paulo_tz = pytz.timezone('America/Sao_Paulo')

            cargo = funcionario['cargo'].capitalize() if funcionario['cargo'] else 'Não especificado'

            created_at = 'Não especificado'
            if funcionario.get('created_at'):
                try:
                    created_at_dt = datetime.fromisoformat(funcionario['created_at'].replace('Z', '+00:00'))
                    created_at_dt = created_at_dt.astimezone(sao_paulo_tz)
                    created_at = created_at_dt.strftime('%d/%m/%Y %H:%M:%S')
                except Exception as e:
                    print(f"Erro ao formatar data de criação para {funcionario['id']}: {str(e)}")
                    created_at = 'Formato inválido'

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

            # Armazenar no cache por 5 minutos
            redis_client.setex(cache_key, 300, json.dumps(result))
            return jsonify(result)
        except Exception as e:
            print(f"Erro em get_funcionario_details: {str(e)}")
            return jsonify({'error': str(e)}), 500

    elif request.method == 'PATCH':
        try:
            if user['cargo'] not in ['admin', 'secretaria']:
                print("Erro: Usuário não tem permissão para acessar esta rota")
                return jsonify({'error': 'Proibido: Apenas admin ou secretaria podem acessar esta rota'}), 403

            data = request.json
            print(f"Dados recebidos para atualização do funcionário {id}: {data}")

            old_data = execute_supabase_query(
                supabase.table('funcionarios')
                .select('nome, cpf, cargo, polo_id, polos!funcionarios_polo_id_fkey(nome), unidade')
                .eq('id', id)
                .single()
            )

            update_data = {
                'nome': data.get('nome'),
                'cpf': data.get('cpf'),
                'cargo': data.get('cargo'),
                'polo_id': supabase.table('polos').select('id').eq('nome', data.get('polo_name')).execute().data[0]['id'],
                'unidade': data.get('unidade')
            }

            update_data = {k: v for k, v in update_data.items() if v is not None}
            print(f"Dados para atualização no Supabase: {update_data}")

            response = supabase.table('funcionarios').update(update_data).eq('id', id).execute()
            if not response.data:
                print(f"Funcionário com ID {id} não encontrado")
                return jsonify({'error': 'Funcionário não encontrado'}), 404

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
            if user['cargo'] not in ['admin', 'secretaria']:
                print("Erro: Usuário não tem permissão para acessar esta rota")
                return jsonify({'error': 'Proibido: Apenas admin ou secretaria podem acessar esta rota'}), 403

            funcionario = execute_supabase_query(
                supabase.table('funcionarios')
                .select('id, nome, cpf, cargo, polo_id, polos!funcionarios_polo_id_fkey(nome), unidade')
                .eq('id', id)
                .single()
            )

            if not funcionario:
                print(f"Funcionário com ID {id} não encontrado")
                return jsonify({'error': 'Funcionário não encontrado'}), 404

            response = supabase.table('funcionarios').delete().eq('id', id).execute()

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
        return jsonify({'error': 'Não autorizado'}), 401

    # Gerar chave de cache
    cache_key = f"polos:{user['id']}"
    cached_data = redis_client.get(cache_key)
    if cached_data:
        print(f"Cache hit para polos: {cache_key}, tamanho: {len(cached_data)} bytes")
        return jsonify(json.loads(cached_data))

    try:
        polos = execute_supabase_query(
            supabase.table('polos').select('id, nome')
        )
        result = [{'id': polo['id'], 'nome': polo['nome']} for polo in polos]

        # Armazenar no cache por 5 minutos
        redis_client.setex(cache_key, 300, json.dumps(result))
        return jsonify(result)
    except Exception as e:
        print(f"Erro em get_polos: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/alunos', methods=['GET'])
def manage_alunos():
    user = get_current_user()
    if not user:
        print("Erro: Usuário não autenticado em /api/alunos")
        return jsonify({'error': 'Não autorizado'}), 401

    # Gerar chave de cache
    params = request.args.to_dict()
    cache_key = f"alunos:{user['id']}:{json.dumps(params, sort_keys=True)}"
    cached_data = redis_client.get(cache_key)
    if cached_data:
        print(f"Cache hit para alunos: {cache_key}, tamanho: {len(cached_data)} bytes")
        return jsonify(json.loads(cached_data))

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

        total_response = base_query.execute()
        total_alunos = total_response.count

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
            dias_matriculados = {}
            cognitive_count = motor_count = 0
            total_matriculas = len(matriculas)
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

            dias_completos = sum(1 for dia, counts in dias_matriculados.items() if counts['cognitiva'] >= 1 and counts['motora'] >= 1)
            aluno_status = 'sem_matriculas'
            if total_matriculas == 4 and dias_completos == 2 and cognitive_count == 2 and motor_count == 2:
                aluno_status = 'complete'
            elif dias_completos >= 1:
                aluno_status = 'partial'
            elif cognitive_count > 0 or motor_count > 0:
                aluno_status = 'pending'

            if status and status.lower() != 'tudo' and aluno_status != status.lower():
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
                'status': aluno_status
            })

        # Armazenar no cache por 5 minutos
        response_data = {
            'data': result,
            'total_pages': total_pages,
            'current_page': 1,
            'total_alunos': len(result)
        }
        redis_client.setex(cache_key, 300, json.dumps(response_data))
        return jsonify(response_data)
    except Exception as e:
        print(f"Erro em get_alunos: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/alunos/polo_count', methods=['GET'])
def get_alunos_polo_count():
    user = get_current_user()
    if not user:
        print("Erro: Usuário não autenticado em /api/alunos/polo_count")
        return jsonify({'error': 'Não autorizado'}), 401

    # Gerar chave de cache
    cache_key = f"alunos_polo_count:{user['id']}"
    cached_data = redis_client.get(cache_key)
    if cached_data:
        print(f"Cache hit para alunos_polo_count: {cache_key}, tamanho: {len(cached_data)} bytes")
        return jsonify(json.loads(cached_data))

    try:
        if 'polo_id' not in user or not user['polo_id']:
            print("Erro: Usuário não tem polo_id associado")
            return jsonify({'error': 'Usuário não tem polo associado'}), 400

        base_query = supabase.table('alunos').select('id', count='exact').eq('polo_id', user['polo_id'])
        response = base_query.execute()
        total_alunos_polo = response.count

        result = {'total_alunos_polo': total_alunos_polo}

        # Armazenar no cache por 5 minutos
        redis_client.setex(cache_key, 300, json.dumps(result))
        return jsonify(result)
    except Exception as e:
        print(f"Erro em get_alunos_polo_count: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/alunos/<id>', methods=['PATCH'])
def update_aluno(id):
    print(f"Requisição recebida para /api/alunos/{id} com método PATCH")
    user = get_current_user()
    if not user:
        print("Erro: Usuário não autenticado em /api/alunos/<id>")
        return jsonify({'error': 'Não autorizado'}), 401
    try:
        data = request.json
        print(f"Dados recebidos para atualização de aluno: {data}")

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
        update_data = {k: v for k, v in update_data.items() if v is not None}
        print(f"Dados para atualização no Supabase (aluno): {update_data}")

        response = supabase.table('alunos').update(update_data).eq('id', id).execute()
        if not response.data:
            print(f"Aluno com ID {id} não encontrado")
            return jsonify({'error': 'Aluno não encontrado'}), 404

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

        invalidate_turmas_ativas_cache()
        redis_client.delete(f"dashboard_data:{user['id']}:{user['cargo']}")

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
        return jsonify({'error': 'Não autorizado'}), 401
    try:
        aluno = supabase.table('alunos').select('id, nome').eq('id', id).execute().data
        if not aluno:
            print(f"Aluno com ID {id} não encontrado")
            return jsonify({'error': 'Aluno não encontrado'}), 404

        supabase.table('matriculas').delete().eq('aluno_id', id).execute()

        log_action(
            user_id=user['id'],
            action_type='DELETE',
            entity_type='MATRICULA',
            entity_id=id,
            details={'aluno_nome': aluno[0]['nome']}
        )

        invalidate_turmas_ativas_cache()
        redis_client.delete(f"dashboard_data:{user['id']}:{user['cargo']}")

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
        return jsonify({'error': 'Não autorizado'}), 401

    # Gerar chave de cache
    params = request.args.to_dict()
    cache_key = f"alunos_paginados:{user['id']}:{json.dumps(params, sort_keys=True)}"
    cached_data = redis_client.get(cache_key)
    if cached_data:
        print(f"Cache hit para alunos_paginados: {cache_key}, tamanho: {len(cached_data)} bytes")
        return jsonify(json.loads(cached_data))

    try:
        count_only = request.args.get('count_only', 'false').lower() == 'true'
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 100))

        nome = request.args.get('nome', '').strip()
        matricula = request.args.get('matricula', '').strip()
        polo_name = request.args.get('polo_name', '').strip()
        turma_unidade = request.args.get('turma_unidade', '').strip()
        genero = request.args.get('genero', '').strip()
        pcd = request.args.get('pcd', '').strip()
        unidade = request.args.get('unidade', '').strip()
        etapa = request.args.get('etapa', '').strip()
        status = request.args.get('status', '').strip()

        print(f"Filtro turma_unidade recebido (usando como unidade): {turma_unidade}")

        if etapa and etapa.lower() != 'tudo':
            etapa = f"{etapa}º Ano"

        # Query para contar os alunos
        base_query = supabase.table('alunos').select('id', count='exact')

        print(f"Cargo do usuário: {user['cargo']}")

        # Aplicar filtros por cargo apenas para cargos relevantes
        unidades_do_polo = []
        if user['cargo'] in ['coordenador', 'diretor', 'monitor']:
            if user['cargo'] == 'coordenador' and user.get('polo_id'):
                polo_query = supabase.table('polos').select('unidades, nome').eq('id', user['polo_id']).single()
                polo_data = execute_supabase_query(polo_query)
                if polo_data and 'unidades' in polo_data and polo_data['unidades']:
                    unidades_do_polo = [unidade for unidade in polo_data['unidades'] if isinstance(unidade, str)]
                    print(f"Unidades associadas ao polo {user['polo_id']} ({polo_data['nome']}): {unidades_do_polo}")
                else:
                    print(f"Nenhuma unidade encontrada para o polo {user['polo_id']}")
                    unidades_do_polo = []

            if user['cargo'] in ['diretor', 'monitor']:
                if user.get('unidade'):
                    base_query = base_query.eq('unidade', user['unidade'])
                    print(f"Filtro por unidade (diretor/monitor): {user['unidade']}")
                else:
                    print(f"Usuário {user['id']} ({user['cargo']}) não tem unidade associada")
                    return jsonify({
                        'data': [],
                        'total_pages': 1,
                        'current_page': 1,
                        'total_alunos': 0
                    })
            elif user['cargo'] == 'coordenador':
                if unidades_do_polo:
                    base_query = base_query.in_('unidade', unidades_do_polo)
                    print(f"Filtro por unidades (coordenador): {unidades_do_polo}")
                else:
                    print(f"Usuário {user['id']} ({user['cargo']}) não tem unidades associadas ao polo {user['polo_id']}")
                    return jsonify({
                        'data': [],
                        'total_pages': 1,
                        'current_page': 1,
                        'total_alunos': 0
                    })

        if nome:
            base_query = base_query.ilike('nome', f'%{nome}%')
        if matricula:
            base_query = base_query.ilike('matricula', f'%{matricula}%')
        if polo_name and polo_name.lower() != 'tudo':
            polo_query = supabase.table('polos').select('id').eq('nome', polo_name).execute()
            if polo_query.data:
                polo_id = polo_query.data[0]['id']
                print(f"Polo encontrado: {polo_name}, ID: {polo_id}")
                base_query = base_query.eq('polo_id', polo_id)
            else:
                print(f"Polo com nome {polo_name} não encontrado no banco de dados")
                return jsonify({
                    'data': [],
                    'total_pages': 1,
                    'current_page': 1,
                    'total_alunos': 0
                })
        if turma_unidade and turma_unidade.lower() != 'tudo':
            base_query = base_query.ilike('unidade', f'%{turma_unidade}%')
        if genero and genero.lower() != 'tudo':
            base_query = base_query.eq('genero', genero)
        if pcd and pcd.lower() != 'tudo':
            base_query = base_query.eq('pcd', 'Com Deficiência' if pcd.lower() == 'com deficiência' else 'Sem Deficiência')
        if unidade and unidade.lower() != 'tudo':
            base_query = base_query.ilike('unidade', f'%{unidade}%')
        if etapa and etapa.lower() != 'tudo':
            base_query = base_query.eq('etapa', etapa)

        # Log para depurar a query antes da execução
        print(f"Query base_query após aplicar filtros: {base_query}")

        if count_only:
            total_response = base_query.execute()
            total_alunos = total_response.count
            print(f"Total de alunos (count_only): {total_alunos}")
            return jsonify({'total_alunos': total_alunos})

        # Executar a query para contar o total de alunos
        total_response = base_query.execute()
        total_alunos = total_response.count
        print(f"Total de alunos encontrados antes do filtro de status: {total_alunos}")

        # Log para verificar alguns registros retornados (apenas se polo_name != 'tudo')
        if polo_name and polo_name.lower() != 'tudo':
            count_query_with_data = supabase.table('alunos').select('id, nome, polo_id, unidade, etapa, turno').eq('polo_id', polo_id).limit(5).execute()
            print(f"Primeiros 5 alunos para polo_id {polo_id}: {count_query_with_data.data}")

        # Query principal para buscar os dados completos
        query = supabase.table('alunos').select(
            'id, nome, matricula, polo_id, polos(nome), turma_unidade, genero, pcd, unidade, etapa, turno, data_nascimento, matriculas(turmas(disciplinas(tipo), dia_semana, nome, faixa_etaria, periodo, polos!turmas_polo_id_fkey(nome)))'
        )

        # Aplicar os mesmos filtros por cargo na query principal
        if user['cargo'] in ['diretor', 'monitor']:
            if user.get('unidade'):
                query = query.eq('unidade', user['unidade'])
                print(f"Filtro por unidade na query principal (diretor/monitor): {user['unidade']}")
        elif user['cargo'] == 'coordenador':
            if unidades_do_polo:
                query = query.in_('unidade', unidades_do_polo)
                print(f"Filtro por unidades na query principal (coordenador): {unidades_do_polo}")

        if polo_name and polo_name.lower() != 'tudo':
            polo_query = supabase.table('polos').select('id').eq('nome', polo_name).execute()
            if polo_query.data:
                polo_id = polo_query.data[0]['id']
                query = query.eq('polo_id', polo_id)
        if nome:
            query = query.ilike('nome', f'%{nome}%')
        if matricula:
            query = query.ilike('matricula', f'%{matricula}%')
        if turma_unidade and turma_unidade.lower() != 'tudo':
            query = query.ilike('unidade', f'%{turma_unidade}%')
        if genero and genero.lower() != 'tudo':
            query = query.eq('genero', genero)
        if pcd and pcd.lower() != 'tudo':
            query = query.eq('pcd', 'Com Deficiência' if pcd.lower() == 'com deficiência' else 'Sem Deficiência')
        if unidade and unidade.lower() != 'tudo':
            query = query.ilike('unidade', f'%{unidade}%')
        if etapa and etapa.lower() != 'tudo':
            query = query.eq('etapa', etapa)

        # Log para depurar a query principal
        print(f"Query principal após aplicar filtros: {query}")

        batch_size = 1000
        alunos = []
        for start in range(0, total_alunos, batch_size):
            end = min(start + batch_size - 1, total_alunos - 1)
            batch_query = query.range(start, end)
            batch_alunos = execute_supabase_query(batch_query)
            alunos.extend(batch_alunos)

        print(f"Alunos retornados do Supabase (primeiros 5): {alunos[:5]}")

        total_pages = (total_alunos + per_page - 1) // per_page

        result = []
        for aluno in alunos:
            matriculas = aluno.get('matriculas', [])
            dias_matriculados = {}
            cognitive_count = motor_count = 0
            total_matriculas = len(matriculas)
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

            dias_completos = sum(1 for dia, counts in dias_matriculados.items() if counts['cognitiva'] >= 1 and counts['motora'] >= 1)
            aluno_status = 'sem_matriculas'
            if total_matriculas == 4 and dias_completos == 2 and cognitive_count == 2 and motor_count == 2:
                aluno_status = 'complete'
            elif dias_completos >= 1:
                aluno_status = 'partial'
            elif cognitive_count > 0 or motor_count > 0:
                aluno_status = 'pending'

            print(f"Aluno {aluno['nome']}: total_matriculas={total_matriculas}, dias_completos={dias_completos}, cognitive_count={cognitive_count}, motor_count={motor_count}, status={aluno_status}, polo_id={aluno['polo_id']}")

            if status and status.lower() != 'tudo' and aluno_status != status.lower():
                continue

            # Preparar os dados das matrículas para o modal
            enrollment_details = []
            for m in matriculas:
                turma = m['turmas']
                polo = turma.get('polos', {}) if turma else {}
                enrollment_details.append({
                    'name': turma.get('nome', 'Não especificado'),
                    'type': turma.get('disciplinas', {}).get('tipo', 'Desconhecido'),
                    'grades': turma.get('faixa_etaria', []),
                    'day': turma.get('dia_semana', 'Não especificado'),
                    'period': turma.get('periodo', 'Não especificado'),
                    'polo_name': polo.get('nome', 'Não especificado')
                })

            aluno_data = {
                'id': aluno['id'],
                'name': aluno['nome'],
                'matricula': aluno['matricula'],
                'polo_name': aluno['polos']['nome'] if 'polos' in aluno else 'Não especificado',
                'turma_unidade': aluno['turma_unidade'],  # Incluir o campo turma_unidade
                'genero': aluno['genero'],
                'pcd': aluno['pcd'],
                'unidade': aluno['unidade'],
                'etapa': aluno['etapa'],
                'turno': aluno['turno'],
                'data_nascimento': aluno['data_nascimento'],
                'status': aluno_status,
                'enrollments': enrollment_details  # Adicionar os detalhes das matrículas
            }
            result.append(aluno_data)

        print(f"Total de alunos após filtro de status: {len(result)}")
        print(f"Exemplo de alunos após filtro (primeiros 5): {result[:5]}")

        start = (page - 1) * per_page
        end = min(start + per_page, len(result))
        paginated_result = result[start:end]

        response_data = {
            'data': paginated_result,
            'total_pages': total_pages,
            'current_page': page,
            'total_alunos': len(result)
        }

        print(f"Resultado final (primeiros 5): {paginated_result[:5]}")

        redis_client.setex(cache_key, 300, json.dumps(response_data))
        return jsonify(response_data)
    except Exception as e:
        print(f"Erro em get_alunos_paginados: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/turmas', methods=['GET', 'POST'])
def get_turmas():
    user = get_current_user()
    if not user:
        print("Erro: Usuário não autenticado em /api/turmas")
        return jsonify({'error': 'Não autorizado'}), 401

    # Gerar chave de cache para GET
    if request.method == 'GET':
        cache_key = f"turmas:{user['id']}:{user['cargo']}"
        cached_data = redis_client.get(cache_key)
        if cached_data:
            print(f"Cache hit para turmas: {cache_key}, tamanho: {len(cached_data)} bytes")
            return jsonify(json.loads(cached_data))

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

            # Armazenar no cache por 5 minutos
            redis_client.setex(cache_key, 300, json.dumps(result))
            return jsonify(result)
        except Exception as e:
            print(f"Erro em get_turmas: {str(e)}")
            return jsonify({'error': str(e)}), 500
    elif request.method == 'POST':
        print("Requisição recebida para /api/turmas com método POST")
        data = request.json
        print(f"Dados recebidos para criação de turma: {data}")
        try:
            # Validação de campos obrigatórios
            required_fields = ['name', 'disciplina_id', 'grades', 'day', 'period', 'capacity', 'polo_name']
            missing_fields = [field for field in required_fields if field not in data or data[field] is None or data[field] == '']
            if missing_fields:
                error_msg = f"Campos obrigatórios ausentes: {', '.join(missing_fields)}"
                print(error_msg)
                return jsonify({'error': error_msg}), 400

            disciplina_id = data['disciplina_id']
            print(f"Disciplina ID recebida: {disciplina_id}")
            disciplina = execute_supabase_query(
                supabase.table('disciplinas').select('id, nome, tipo').eq('id', disciplina_id).single()
            )
            if not disciplina:
                error_msg = f"Disciplina com ID {disciplina_id} não encontrada"
                print(error_msg)
                return jsonify({'error': error_msg}), 400

            tipo = disciplina['tipo']
            print(f"Tipo da disciplina: {tipo}")

            polo_query = supabase.table('polos').select('id').eq('nome', data['polo_name'])
            polo = execute_supabase_query(polo_query)
            if not polo:
                error_msg = f"Polo com nome {data['polo_name']} não encontrado"
                print(error_msg)
                return jsonify({'error': error_msg}), 400
            polo_id = polo[0]['id']
            print(f"Polo ID encontrado: {polo_id}")

            # Validação adicional
            if not isinstance(data['grades'], list):
                error_msg = "Faixa etária deve ser uma lista"
                print(error_msg)
                return jsonify({'error': error_msg}), 400
            if data['day'] not in ['seg', 'ter', 'qua', 'qui', 'sex']:
                error_msg = f"Dia da semana inválido: {data['day']}"
                print(error_msg)
                return jsonify({'error': error_msg}), 400
            if data['period'] not in ['manha', 'tarde']:
                error_msg = f"Período inválido: {data['period']}"
                print(error_msg)
                return jsonify({'error': error_msg}), 400
            try:
                capacity = int(data['capacity'])
                if capacity < 0:
                    error_msg = "Capacidade deve ser um número não negativo"
                    print(error_msg)
                    return jsonify({'error': error_msg}), 400
            except (ValueError, TypeError):
                error_msg = "Capacidade deve ser um número válido"
                print(error_msg)
                return jsonify({'error': error_msg}), 400

            turma_data = {
                'nome': data['name'],
                'disciplina_id': disciplina_id,
                'faixa_etaria': data['grades'],
                'dia_semana': data['day'],
                'periodo': data['period'],
                'capacidade': capacity,
                'polo_id': polo_id
            }
            print(f"Dados para inserção no Supabase: {turma_data}")
            response = supabase.table('turmas').insert(turma_data).execute()
            if not response.data:
                error_msg = "Falha ao inserir turma no banco de dados"
                print(error_msg)
                return jsonify({'error': error_msg}), 500
            turma = response.data[0]
            print(f"Turma criada com sucesso: {turma}")

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

            invalidate_turmas_ativas_cache()
            redis_client.delete(f"dashboard_data:{user['id']}:{user['cargo']}")

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
def manage_turma(id):
    print(f"Requisição recebida para /api/turmas/{id} com método {request.method}")
    user = get_current_user()
    if not user:
        print("Erro: Usuário não autenticado em /api/turmas/<id>")
        return jsonify({'error': 'Não autorizado'}), 401

    if request.method == 'PATCH':
        try:
            data = request.json
            print(f"Dados recebidos para atualização: {data}")

            old_data = execute_supabase_query(
                supabase.table('turmas')
                .select('nome, faixa_etaria, dia_semana, periodo, capacidade, polos!turmas_polo_id_fkey(nome)')
                .eq('id', id)
                .single()
            )

            update_data = {
                'nome': data.get('name'),
                'faixa_etaria': data.get('grades'),
                'dia_semana': data.get('day'),
                'periodo': data.get('period'),
                'capacidade': int(data['capacity'])
            }

            update_data = {k: v for k, v in update_data.items() if v is not None}
            print(f"Dados para atualização no Supabase: {update_data}")

            response = supabase.table('turmas').update(update_data).eq('id', id).execute()
            if not response.data:
                print(f"Turma com ID {id} não encontrada no Supabase")
                return jsonify({'error': 'Turma não encontrada'}), 404

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

            invalidate_turmas_ativas_cache()
            redis_client.delete(f"dashboard_data:{user['id']}:{user['cargo']}")

            print(f"Turma com ID {id} atualizada com sucesso")
            return jsonify({'message': 'Turma atualizada com sucesso'})
        except Exception as e:
            print(f"Erro em update_turma: {str(e)}")
            return jsonify({'error': str(e)}), 500

    elif request.method == 'DELETE':
        try:
            turma = execute_supabase_query(
                supabase.table('turmas')
                .select('id, nome, polos!turmas_polo_id_fkey(nome)')
                .eq('id', id)
                .single()
            )

            if not turma:
                print(f"Turma com ID {id} não encontrada")
                return jsonify({'error': 'Turma não encontrada'}), 404

            supabase.table('matriculas').delete().eq('turma_id', id).execute()

            response = supabase.table('turmas').delete().eq('id', id).execute()

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

            invalidate_turmas_ativas_cache()
            redis_client.delete(f"dashboard_data:{user['id']}:{user['cargo']}")

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
        return jsonify({'error': 'Não autorizado'}), 401
    try:
        turma = supabase.table('turmas').select('id, nome, polos!turmas_polo_id_fkey(nome)').eq('id', id).execute().data
        if not turma:
            print(f"Turma com ID {id} não encontrada")
            return jsonify({'error': 'Turma não encontrada'}), 404

        supabase.table('matriculas').delete().eq('turma_id', id).execute()

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

        invalidate_turmas_ativas_cache()
        redis_client.delete(f"dashboard_data:{user['id']}:{user['cargo']}")

        print(f"Alunos desmatriculados da turma com ID {id}")
        return jsonify({'message': 'Alunos desmatriculados com sucesso'})
    except Exception as e:
        print(f"Erro em unenroll_turma: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/turmas_ativas', methods=['GET'])
def get_turmas_ativas():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Não autorizado'}), 401

    cache_key = f"turmas_ativas:{user['id']}:{user['cargo']}"
    cached_data = redis_client.get(cache_key)
    if cached_data:
        print(f"Cache hit para turmas_ativas: {cache_key}, tamanho: {len(cached_data)} bytes")
        return jsonify(json.loads(cached_data))

    try:
        sao_paulo_tz = pytz.timezone('America/Sao_Paulo')
        current_time = datetime.now(sao_paulo_tz)
        current_hour = current_time.hour
        current_period = 'manha' if 6 <= current_hour <= 12 else 'tarde'
        weekday_map = {0: 'seg', 1: 'ter', 2: 'qua', 3: 'qui', 4: 'sex'}
        current_weekday = weekday_map.get(current_time.weekday())
        if not current_weekday:
            response_data = {'current_period': current_period, 'current_day': None, 'turmas': []}
            redis_client.setex(cache_key, 300, json.dumps(response_data))
            return jsonify(response_data)

        query = supabase.table('turmas').select(
            'id, nome, disciplinas(tipo), periodo, capacidade, matriculas(id, aluno_id, alunos(nome)), polos!turmas_polo_id_fkey(nome)'
        ).eq('periodo', current_period).eq('dia_semana', current_weekday)

        if user['cargo'] in ['admin', 'secretaria']:
            turmas = execute_supabase_query(query)
        elif user['cargo'] in ['monitor', 'diretor', 'coordenador']:
            turmas = execute_supabase_query(query.eq('polo_id', user['polo_id']))
        else:
            turmas = []

        result = []
        for turma in turmas:
            try:
                matriculas = turma.get('matriculas', [])
                enrollment_count = len(matriculas)
                if enrollment_count == 0:
                    continue
                polo_name = turma.get('polos', {}).get('nome', 'Não especificado')
                alunos = [
                    {
                        'id': m['aluno_id'],
                        'name': m.get('alunos', {}).get('nome', 'Desconhecido')
                    } for m in matriculas
                ]
                result.append({
                    'id': turma['id'],
                    'name': turma['nome'],
                    'subject': 'Cognitiva' if turma.get('disciplinas', {}).get('tipo') == 'cognitiva' else 'Motora',
                    'type': turma.get('disciplinas', {}).get('tipo', 'Desconhecido'),
                    'period': turma['periodo'],
                    'capacity': turma['capacidade'],
                    'enrollmentCount': enrollment_count,
                    'polo_name': polo_name,
                    'students': alunos
                })
            except Exception as e:
                print(f"Erro ao processar turma {turma.get('id', 'desconhecida')}: {str(e)}")
                continue

        response_data = {
            'current_period': current_period,
            'current_day': current_weekday,
            'turmas': result
        }

        redis_client.setex(cache_key, 300, json.dumps(response_data))
        return jsonify(response_data)
    except Exception as e:
        print(f"Erro em get_turmas_ativas: {str(e)}")
        return jsonify({'error': 'Erro interno ao buscar turmas ativas'}), 500

@app.route('/api/matriculas', methods=['GET', 'POST'])
def manage_matriculas():
    user = get_current_user()
    if not user:
        print("Erro: Usuário não autenticado em /api/matriculas")
        return jsonify({'error': 'Não autorizado'}), 401

    # Gerar chave de cache para GET
    if request.method == 'GET':
        cache_key = f"matriculas:{user['id']}"
        cached_data = redis_client.get(cache_key)
        if cached_data:
            print(f"Cache hit para matriculas: {cache_key}, tamanho: {len(cached_data)} bytes")
            return jsonify(json.loads(cached_data))

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

            # Armazenar no cache por 5 minutos
            redis_client.setex(cache_key, 300, json.dumps(result))
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

            aluno = execute_supabase_query(
                supabase.table('alunos').select('nome').eq('id', data['alunoId']).single()
            )
            turma = execute_supabase_query(
                supabase.table('turmas').select('nome, polos!turmas_polo_id_fkey(nome)').eq('id', data['turmaId']).single()
            )

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

            invalidate_turmas_ativas_cache()
            redis_client.delete(f"dashboard_data:{user['id']}:{user['cargo']}")

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
        return jsonify({'error': 'Não autorizado'}), 401
    try:
        matricula = supabase.table('matriculas').select('id, turma_id, turmas(polo_id)').eq('id', id).single().execute().data
        if not matricula:
            return jsonify({'error': 'Matrícula não encontrada'}), 404

        if user['cargo'] not in ['admin', 'secretaria']:
            if matricula['turmas']['polo_id'] != user['polo_id']:
                return jsonify({'error': 'Proibido: Você não tem permissão para remover matrículas deste polo'}), 403

        matricula_details = execute_supabase_query(
            supabase.table('matriculas')
            .select('aluno_id, alunos(nome), turma_id, turmas(nome, polos!turmas_polo_id_fkey(nome))')
            .eq('id', id)
            .single()
        )

        supabase.table('matriculas').delete().eq('id', id).execute()

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

        invalidate_turmas_ativas_cache()
        redis_client.delete(f"dashboard_data:{user['id']}:{user['cargo']}")

        return jsonify({'message': 'Matrícula removida com sucesso'})
    except Exception as e:
        print(f"Erro em delete_matricula: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/logs', methods=['GET'])
def get_logs():
    user = get_current_user()
    if not user:
        print("Erro: Usuário não autenticado em /api/logs")
        return jsonify({'error': 'Não autorizado'}), 401

    if user['cargo'] not in ['admin', 'secretaria']:
        print("Erro: Usuário não tem permissão para acessar os logs")
        return jsonify({'error': 'Proibido: Apenas admin ou secretaria podem acessar os logs'}), 403

    # Gerar chave de cache
    user_id = request.args.get('user_id', '').strip()
    action_type = request.args.get('action_type', '').strip()
    entity_type = request.args.get('entity_type', '').strip()
    cache_key = f"logs:{user['id']}:{user_id}:{action_type}:{entity_type}"
    cached_data = redis_client.get(cache_key)
    if cached_data:
        print(f"Cache hit para logs: {cache_key}, tamanho: {len(cached_data)} bytes")
        return jsonify(json.loads(cached_data))

    try:
        query = supabase.table('logs').select('*, funcionarios(nome, cargo)').order('created_at', desc=True)

        if user_id:
            query = query.eq('user_id', user_id)
        if action_type:
            query = query.eq('action_type', action_type)
        if entity_type:
            query = query.eq('entity_type', entity_type)

        logs = execute_supabase_query(query)

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

        # Armazenar no cache por 5 minutos
        redis_client.setex(cache_key, 300, json.dumps(result))
        return jsonify(result)
    except Exception as e:
        print(f"Erro em get_logs: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/disciplinas', methods=['GET'])
def get_disciplinas():
    user = get_current_user()
    if not user:
        print("Erro: Usuário não autenticado em /api/disciplinas")
        return jsonify({'error': 'Não autorizado'}), 401

    # Gerar chave de cache
    cache_key = f"disciplinas:{user['id']}"
    cached_data = redis_client.get(cache_key)
    if cached_data:
        print(f"Cache hit para disciplinas: {cache_key}, tamanho: {len(cached_data)} bytes")
        return jsonify(json.loads(cached_data))

    try:
        disciplinas = execute_supabase_query(
            supabase.table('disciplinas').select('id, nome, tipo')
        )
        result = [{'id': disciplina['id'], 'nome': disciplina['nome'], 'tipo': disciplina['tipo']} for disciplina in disciplinas]

        # Armazenar no cache por 5 minutos
        redis_client.setex(cache_key, 300, json.dumps(result))
        return jsonify(result)
    except Exception as e:
        print(f"Erro em get_disciplinas: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/busca_ativa', methods=['GET', 'POST'])
def busca_ativa():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Não autorizado'}), 401

    # Gerar chave de cache para GET
    if request.method == 'GET':
        cache_key = f"busca_ativa:{user['id']}"
        cached_data = redis_client.get(cache_key)
        if cached_data:
            print(f"Cache hit para busca_ativa: {cache_key}, tamanho: {len(cached_data)} bytes")
            return jsonify(json.loads(cached_data))

    try:
        if request.method == 'GET':
            response = supabase.table('busca_ativa').select('*').execute()
            result = response.data

            # Armazenar no cache por 5 minutos
            redis_client.setex(cache_key, 300, json.dumps(result))
            return jsonify(result)
        elif request.method == 'POST':
            data = request.json
            required_fields = ['id_aluno', 'funcionario_id', 'resultado', 'sucesso']
            if not all(field in data for field in required_fields):
                return jsonify({'error': 'Campos obrigatórios ausentes'}), 400
            data['data'] = datetime.now().strftime('%Y-%m-%d')
            response = supabase.table('busca_ativa').insert(data).execute()
            if not response.data:
                return jsonify({'error': 'Erro ao criar relatório'}), 500
            return jsonify({'message': 'Relatório criado com sucesso'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/salas', methods=['GET', 'POST'])
def manage_salas():
    user = get_current_user()
    if not user:
        print("Erro: Usuário não autenticado em /api/salas")
        return jsonify({'error': 'Não autorizado'}), 401

    if request.method == 'GET':
        cache_key = f"salas:{user['id']}:{user['cargo']}"
        cached_data = redis_client.get(cache_key)
        if cached_data:
            print(f"Cache hit para salas: {cache_key}, tamanho: {len(cached_data)} bytes")
            return jsonify(json.loads(cached_data))

        try:
            query = supabase.table('salas').select(
                'id, nome, capacidade, turmas_vinculadas, polo_id, polos!fk_polo_id(nome)'
            )

            if user['cargo'] in ['admin', 'secretaria']:
                print(f"Usuário {user['id']} ({user['cargo']}) buscando todas as salas")
                salas = execute_supabase_query(query)
            else:
                if not user.get('polo_id'):
                    print(f"Erro: Usuário {user['id']} ({user['cargo']}) sem polo_id para salas")
                    return jsonify({'error': 'Usuário não tem polo associado'}), 400
                print(f"Usuário {user['id']} ({user['cargo']}) buscando salas do polo {user['polo_id']}")
                salas = execute_supabase_query(query.eq('polo_id', user['polo_id']))

            print(f"Total de salas encontradas: {len(salas)}")
            result = []
            turma_ids = set()
            for sala in salas:
                if sala.get('turmas_vinculadas') and isinstance(sala['turmas_vinculadas'], list):
                    turma_ids.update(sala['turmas_vinculadas'])

            turmas_dict = {}
            if turma_ids:
                turmas_query = supabase.table('turmas').select(
                    'id, nome, disciplina_id, disciplinas!turmas_disciplina_id_fkey(tipo), faixa_etaria, dia_semana, periodo, polos!turmas_polo_id_fkey(nome)'
                ).in_('id', list(turma_ids))
                turmas = execute_supabase_query(turmas_query)
                for turma in turmas:
                    turmas_dict[turma['id']] = {
                        'id': turma['id'],
                        'nome': turma['nome'],
                        'tipo': turma['disciplinas']['tipo'] if turma.get('disciplinas') else 'Desconhecido',
                        'faixa_etaria': turma['faixa_etaria'] or [],
                        'dia_semana': turma['dia_semana'] or 'Não especificado',
                        'periodo': turma['periodo'] or 'Não especificado',
                        'polo_nome': turma['polos']['nome'] if turma.get('polos') and turma['polos'].get('nome') else 'Não especificado'
                    }
                print(f"Turmas resolvidas: {len(turmas_dict)} turmas para {len(turma_ids)} UUIDs")

            for sala in salas:
                try:
                    polo_name = sala['polos']['nome'] if sala.get('polos') and sala['polos'].get('nome') else 'Não especificado'
                    turmas_vinculadas = []
                    if sala.get('turmas_vinculadas') and isinstance(sala['turmas_vinculadas'], list):
                        turmas_vinculadas = [turmas_dict[turma_id] for turma_id in sala['turmas_vinculadas'] if turma_id in turmas_dict]
                    print(f"Sala {sala['id']}: {len(turmas_vinculadas)} turmas vinculadas")
                    result.append({
                        'id': sala['id'],
                        'nome': sala['nome'],
                        'capacidade': sala['capacidade'],
                        'turmas_vinculadas': turmas_vinculadas,
                        'polo_nome': polo_name
                    })
                except Exception as e:
                    print(f"Erro ao processar sala {sala.get('id', 'desconhecida')}: {str(e)}")
                    continue

            redis_client.setex(cache_key, 300, json.dumps(result))
            print(f"Dados armazenados no cache: {cache_key}, {len(result)} salas")
            return jsonify(result)
        except Exception as e:
            print(f"Erro em get_salas: {str(e)}")
            import traceback
            traceback.print_exc()
            return jsonify({'error': f'Erro ao buscar salas: {str(e)}'}), 500

    elif request.method == 'POST':
        if user['cargo'] not in ['admin', 'secretaria']:
            print("Erro: Usuário não tem permissão para criar salas")
            return jsonify({'error': 'Proibido: Apenas admin ou secretaria podem criar salas'}), 403

        data = request.json
        print(f"Dados recebidos para criação de sala: {data}")
        try:
            required_fields = ['nome', 'capacidade', 'polo_name']
            missing_fields = [field for field in required_fields if field not in data or data[field] is None or data[field] == '']
            if missing_fields:
                error_msg = f"Campos obrigatórios ausentes: {', '.join(missing_fields)}"
                print(error_msg)
                return jsonify({'error': error_msg}), 400

            polo_query = supabase.table('polos').select('id').eq('nome', data['polo_name'])
            polo = execute_supabase_query(polo_query)
            if not polo:
                error_msg = f"Polo com nome {data['polo_name']} não encontrado"
                print(error_msg)
                return jsonify({'error': error_msg}), 400
            polo_id = polo[0]['id']
            print(f"Polo ID encontrado: {polo_id}")

            try:
                capacidade = int(data['capacidade'])
                if capacidade < 0:
                    error_msg = "Capacidade deve ser um número não negativo"
                    print(error_msg)
                    return jsonify({'error': error_msg}), 400
            except (ValueError, TypeError):
                error_msg = "Capacidade deve ser um número válido"
                print(error_msg)
                return jsonify({'error': error_msg}), 400

            sala_data = {
                'nome': data['nome'],
                'capacidade': capacidade,
                'polo_id': polo_id
            }
            print(f"Dados para inserção no Supabase: {sala_data}")
            response = supabase.table('salas').insert(sala_data).execute()
            if not response.data:
                error_msg = "Falha ao inserir sala no banco de dados"
                print(error_msg)
                return jsonify({'error': error_msg}), 500
            sala = response.data[0]
            print(f"Sala criada com sucesso: {sala}")

            log_action(
                user_id=user['id'],
                action_type='CREATE',
                entity_type='SALA',
                entity_id=sala['id'],
                details={
                    'nome': sala['nome'],
                    'capacidade': sala['capacidade'],
                    'polo_nome': data['polo_name']
                }
            )

            invalidate_salas_cache()

            return jsonify({
                'id': sala['id'],
                'nome': sala['nome'],
                'capacidade': sala['capacidade'],
                'turmas_vinculadas': sala['turmas_vinculadas'] or [],
                'polo_nome': data['polo_name']
            })
        except Exception as e:
            print(f"Erro em criar sala (POST): {str(e)}")
            return jsonify({'error': str(e)}), 500

@app.route('/api/salas/<id>', methods=['PATCH', 'DELETE'])
def manage_sala(id):
    print(f"Requisição recebida para /api/salas/{id} com método {request.method}")
    user = get_current_user()
    if not user:
        print("Erro: Usuário não autenticado em /api/salas/<id>")
        return jsonify({'error': 'Não autorizado'}), 401

    if not id or id == 'undefined':
        print("Erro: ID da sala inválido ou não fornecido")
        return jsonify({'error': 'ID da sala inválido'}), 400

    if request.method == 'PATCH':
        if user['cargo'] not in ['admin', 'secretaria']:
            print("Erro: Usuário não tem permissão para atualizar salas")
            return jsonify({'error': 'Proibido: Apenas admin ou secretaria podem atualizar salas'}), 403

        try:
            data = request.json
            print(f"Dados recebidos para atualização: {data}")

            old_data = execute_supabase_query(
                supabase.table('salas')
                .select('nome, capacidade, polos!fk_polo_id(nome)')
                .eq('id', id)
                .single()
            )

            update_data = {
                'nome': data.get('nome'),
                'capacidade': int(data.get('capacidade'))
            }

            if data.get('polo_name'):
                polo_query = supabase.table('polos').select('id').eq('nome', data['polo_name'])
                polo = execute_supabase_query(polo_query)
                if not polo:
                    error_msg = f"Polo com nome {data['polo_name']} não encontrado"
                    print(error_msg)
                    return jsonify({'error': error_msg}), 400
                update_data['polo_id'] = polo[0]['id']

            update_data = {k: v for k, v in update_data.items() if v is not None}
            print(f"Dados para atualização no Supabase: {update_data}")

            response = supabase.table('salas').update(update_data).eq('id', id).execute()
            if not response.data:
                print(f"Sala com ID {id} não encontrada no Supabase")
                return jsonify({'error': 'Sala não encontrada'}), 404

            log_action(
                user_id=user['id'],
                action_type='UPDATE',
                entity_type='SALA',
                entity_id=id,
                details={
                    'old_data': {
                        'nome': old_data['nome'],
                        'capacidade': old_data['capacidade'],
                        'polo_nome': old_data['polos']['nome'] if old_data.get('polos') else 'Não especificado'
                    },
                    'new_data': {
                        'nome': update_data.get('nome', old_data['nome']),
                        'capacidade': update_data.get('capacidade', old_data['capacidade']),
                        'polo_nome': data.get('polo_name', old_data['polos']['nome'] if old_data.get('polos') else 'Não especificado')
                    }
                }
            )

            invalidate_salas_cache()

            print(f"Sala com ID {id} atualizada com sucesso")
            return jsonify({'message': 'Sala atualizada com sucesso'})
        except Exception as e:
            print(f"Erro em update_sala: {str(e)}")
            return jsonify({'error': str(e)}), 500

    elif request.method == 'DELETE':
        if user['cargo'] not in ['admin', 'secretaria']:
            print("Erro: Usuário não tem permissão para excluir salas")
            return jsonify({'error': 'Proibido: Apenas admin ou secretaria podem excluir salas'}), 403

        try:
            sala = execute_supabase_query(
                supabase.table('salas')
                .select('id, nome, polos!fk_polo_id(nome)')
                .eq('id', id)
                .single()
            )

            if not sala:
                print(f"Sala com ID {id} não encontrada")
                return jsonify({'error': 'Sala não encontrada'}), 404

            response = supabase.table('salas').delete().eq('id', id).execute()

            log_action(
                user_id=user['id'],
                action_type='DELETE',
                entity_type='SALA',
                entity_id=id,
                details={
                    'nome': sala['nome'],
                    'polo_nome': sala['polos']['nome'] if sala.get('polos') else 'Não especificado'
                }
            )

            invalidate_salas_cache()

            print(f"Sala com ID {id} excluída com sucesso")
            return jsonify({'message': 'Sala excluída com sucesso'})
        except Exception as e:
            print(f"Erro em delete_sala: {str(e)}")
            return jsonify({'error': str(e)}), 500

@app.route('/api/dashboard_data', methods=['GET'])
def get_dashboard_data():
    user = get_current_user()
    if not user:
        print("Erro: Usuário não autenticado em /api/dashboard_data")
        return jsonify({'error': 'Não autorizado'}), 401

    # Incluir o polo_id e o parâmetro apply_unit_filter na chave de cache
    apply_unit_filter = request.args.get('apply_unit_filter', 'true').lower() == 'true'
    cache_key = f"dashboard_data:{user['id']}:{user['cargo']}:{user.get('polo_id', 'no_polo')}:{apply_unit_filter}"
    cached_data = redis_client.get(cache_key)
    if cached_data:
        print(f"Cache hit para dashboard_data: {cache_key}, tamanho: {len(cached_data)} bytes")
        return jsonify(json.loads(cached_data))

    try:
        sao_paulo_tz = pytz.timezone('America/Sao_Paulo')
        current_time = datetime.now(sao_paulo_tz)
        current_hour = current_time.hour
        current_period = 'manha' if 6 <= current_hour <= 12 else 'tarde'
        weekday_map = {0: 'seg', 1: 'ter', 2: 'qua', 3: 'qui', 4: 'sex'}
        current_weekday = weekday_map.get(current_time.weekday())
        turmas_ativas = {'current_period': current_period, 'current_day': current_weekday, 'turmas': []}
        if current_weekday:
            query = supabase.table('turmas').select(
                'id, nome, disciplinas(tipo), periodo, capacidade, matriculas(id, aluno_id, alunos(nome)), polos!turmas_polo_id_fkey(nome), faixa_etaria, dia_semana'
            ).eq('periodo', current_period).eq('dia_semana', current_weekday).limit(50)
            if user['cargo'] in ['admin', 'secretaria']:
                turmas = execute_supabase_query(query)
            elif user['cargo'] in ['monitor', 'diretor', 'coordenador']:
                if not user.get('polo_id'):
                    print(f"Erro: Usuário {user['id']} ({user['cargo']}) sem polo_id para turmas ativas")
                    turmas = []
                else:
                    turmas = execute_supabase_query(query.eq('polo_id', user['polo_id']))
            else:
                turmas = []
            for turma in turmas:
                matriculas = turma.get('matriculas', [])
                enrollment_count = len(matriculas)
                if enrollment_count == 0:
                    continue
                polo_name = turma.get('polos', {}).get('nome', 'Não especificado')
                alunos = [{'id': m['aluno_id'], 'name': m.get('alunos', {}).get('nome', 'Desconhecido')} for m in matriculas]
                turmas_ativas['turmas'].append({
                    'id': turma['id'], 'name': turma['nome'],
                    'subject': 'Cognitiva' if turma.get('disciplinas', {}).get('tipo') == 'cognitiva' else 'Motora',
                    'type': turma.get('disciplinas', {}).get('tipo', 'Desconhecido'),
                    'period': turma['periodo'], 'capacity': turma['capacidade'],
                    'enrollmentCount': enrollment_count, 'polo_name': polo_name, 'students': alunos,
                    'day': turma['dia_semana'], 'grades': turma['faixa_etaria']
                })

        query = supabase.table('turmas').select(
            'id, nome, disciplinas(tipo), faixa_etaria, dia_semana, periodo, capacidade, matriculas(id), polo_id, polos!turmas_polo_id_fkey(nome)'
        )
        if user['cargo'] in ['admin', 'secretaria']:
            turmas = execute_supabase_query(query)
        elif user['cargo'] in ['monitor', 'diretor', 'coordenador']:
            if not user.get('polo_id'):
                print(f"Erro: Usuário {user['id']} ({user['cargo']}) sem polo_id para turmas")
                return jsonify({'error': 'Usuário não tem polo associado'}), 400
            turmas = execute_supabase_query(query.eq('polo_id', user['polo_id']))
        else:
            turmas = []
        turmas_data = []
        for turma in turmas:
            polo_name = turma['polos']['nome'] if turma.get('polos') and turma['polos'].get('nome') else 'Não especificado'
            turmas_data.append({
                'id': turma['id'], 'name': turma['nome'],
                'subject': 'Cognitiva' if turma['disciplinas']['tipo'] == 'cognitiva' else 'Motora',
                'type': turma['disciplinas']['tipo'], 'grades': turma['faixa_etaria'],
                'day': turma['dia_semana'], 'period': turma['periodo'],
                'capacity': turma['capacidade'], 'enrollmentCount': len(turma['matriculas']),
                'polo_name': polo_name
            })

        # Obter todas as unidades associadas ao polo do funcionário diretamente da tabela polos
        unidades_do_polo = []
        unidades_do_polo_normalizadas = []
        if user['cargo'] in ['diretor', 'coordenador', 'monitor'] and user.get('polo_id'):
            # Consultar o array de unidades na tabela polos
            polo_query = supabase.table('polos').select('unidades, nome').eq('id', user['polo_id']).single()
            polo_data = execute_supabase_query(polo_query)
            if polo_data and 'unidades' in polo_data and polo_data['unidades']:
                # Normalizar as unidades do polo (remover espaços extras, converter para minúsculas, remover acentos)
                unidades_do_polo = [unidade for unidade in polo_data['unidades'] if isinstance(unidade, str)]
                unidades_do_polo_normalizadas = [
                    unidecode(unidade.strip().lower()) for unidade in unidades_do_polo
                ]
                print(f"Unidades associadas ao polo {user['polo_id']} ({polo_data['nome']}): {unidades_do_polo}")
                print(f"Unidades normalizadas do polo: {unidades_do_polo_normalizadas}")
            else:
                print(f"Nenhuma unidade encontrada para o polo {user['polo_id']}")
                unidades_do_polo = []
                unidades_do_polo_normalizadas = []

        # Obter todos os alunos
        base_query = supabase.table('alunos').select('id', count='exact')
        if user['cargo'] in ['diretor', 'coordenador', 'monitor'] and user.get('polo_id'):
            base_query = base_query.eq('polo_id', user['polo_id'])
        total_response = base_query.execute()
        total_alunos = total_response.count
        print(f"Total de alunos antes do filtro: {total_alunos}")

        batch_size = 1000
        alunos = []
        query = supabase.table('alunos').select(
            'id, nome, matricula, turma_unidade, genero, pcd, unidade, etapa, turno, data_nascimento, matriculas(turmas(disciplinas(tipo), dia_semana)), polo_id, polos(nome)'
        )
        if user['cargo'] in ['diretor', 'coordenador', 'monitor'] and user.get('polo_id'):
            query = query.eq('polo_id', user['polo_id'])
        for start in range(0, total_alunos, batch_size):
            end = min(start + batch_size - 1, total_alunos - 1)
            batch_query = query.range(start, end)
            batch_alunos = execute_supabase_query(batch_query)
            alunos.extend(batch_alunos)

        # Adicionar log para verificar os valores de pcd retornados
        print("Valores de pcd retornados para os alunos (primeiros 10):")
        for aluno in alunos[:10]:
            print(f"Aluno: {aluno['nome']}, pcd: {aluno['pcd']}, tipo: {type(aluno['pcd'])}")

        # Filtrar alunos por unidades do polo apenas se apply_unit_filter for True
        alunos_filtrados = alunos
        if apply_unit_filter and user['cargo'] in ['diretor', 'coordenador', 'monitor'] and unidades_do_polo_normalizadas:
            # Normalizar a unidade do aluno para comparação
            alunos_filtrados = [
                aluno for aluno in alunos 
                if aluno['unidade'] and isinstance(aluno['unidade'], str) 
                and unidecode(aluno['unidade'].strip().lower()) in unidades_do_polo_normalizadas
            ]
            print(f"Total de alunos após filtro por unidades do polo: {len(alunos_filtrados)}")
            print(f"Exemplo de alunos filtrados (primeiros 5): {[{k: v for k, v in aluno.items() if k in ['id', 'nome', 'unidade']} for aluno in alunos_filtrados[:5]]}")
            # Alunos não filtrados (para depuração)
            alunos_nao_filtrados = [
                aluno for aluno in alunos 
                if not (aluno['unidade'] and isinstance(aluno['unidade'], str) 
                        and unidecode(aluno['unidade'].strip().lower()) in unidades_do_polo_normalizadas)
            ]
            print(f"Total de alunos NÃO filtrados: {len(alunos_nao_filtrados)}")
            print(f"Exemplo de alunos NÃO filtrados (primeiros 5): {[{k: v for k, v in aluno.items() if k in ['id', 'nome', 'unidade']} for aluno in alunos_nao_filtrados[:5]]}")
            print(f"Unidades dos alunos NÃO filtrados (primeiros 5, normalizadas): {[unidecode(aluno['unidade'].strip().lower()) if aluno['unidade'] and isinstance(aluno['unidade'], str) else None for aluno in alunos_nao_filtrados[:5]]}")

        alunos_data = {'data': [], 'total_pages': 1, 'current_page': 1, 'total_alunos': len(alunos_filtrados)}
        for aluno in alunos_filtrados:
            matriculas = aluno.get('matriculas', [])
            dias_matriculados = {}
            cognitive_count = motor_count = 0
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
            dias_completos = sum(1 for dia, counts in dias_matriculados.items() if counts['cognitiva'] >= 1 and counts['motora'] >= 1)
            status = 'pending'
            if dias_completos == 2:
                status = 'complete'
            elif dias_completos == 1:
                status = 'partial'
            alunos_data['data'].append({
                'id': aluno['id'], 'name': aluno['nome'], 'matricula': aluno['matricula'],
                'turma_unidade': aluno['turma_unidade'],
                'genero': aluno['genero'], 'pcd': aluno['pcd'], 'unidade': aluno['unidade'],
                'etapa': aluno['etapa'], 'turno': aluno['turno'], 'data_nascimento': aluno['data_nascimento'],
                'status': status,
                'polo_name': aluno['polos']['nome'] if 'polos' in aluno else 'Não especificado'
            })

        matriculas = execute_supabase_query(
            supabase.table('matriculas').select('id, aluno_id, turma_id, turmas!left(disciplinas(tipo))')
        )
        matriculas_data = []
        for matricula in matriculas:
            try:
                turma = matricula.get('turmas', {})
                disciplina = turma.get('disciplinas', {}) if turma else {}
                tipo = disciplina.get('tipo', None) if disciplina else None
                required = tipo == 'cognitiva' if tipo else False
                matriculas_data.append({
                    'id': matricula['id'], 'studentId': matricula['aluno_id'],
                    'classId': matricula['turma_id'], 'required': required
                })
            except Exception as e:
                print(f"Erro ao processar matrícula {matricula['id']}: {str(e)}")
                matriculas_data.append({
                    'id': matricula['id'], 'studentId': matricula['aluno_id'],
                    'classId': matricula['turma_id'], 'required': False
                })

        # Simplificar o cálculo de polo_count usando len(alunos_filtrados)
        polo_count = 0
        if user['cargo'] in ['diretor', 'coordenador', 'monitor'] and user.get('polo_id'):
            polo_count = len([aluno for aluno in alunos if aluno['polo_id'] == user['polo_id']])
            print(f"Total de alunos no polo {user['polo_id']}: {polo_count}")

        response_data = {
            'alunos': alunos_data,
            'turmas': turmas_data,
            'matriculas': matriculas_data,
            'turmas_ativas': turmas_ativas,
            'polo_count': {'total_alunos_polo': polo_count}
        }

        redis_client.setex(cache_key, 300, json.dumps(response_data))
        return jsonify(response_data)
    except Exception as e:
        print(f"Erro em get_dashboard_data: {str(e)}")
        return jsonify({'error': 'Erro interno ao buscar dados do dashboard'}), 500
    
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)