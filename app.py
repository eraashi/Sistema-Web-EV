from flask import Flask, request, jsonify, render_template, session, redirect, url_for
from supabase import create_client
from dotenv import load_dotenv
import os
from retrying import retry
from flask_session import Session

app = Flask(__name__)
load_dotenv()
app.secret_key = os.getenv('FLASK_SECRET_KEY')

# Configurar o Flask-Session para usar o sistema de arquivos
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_PERMANENT'] = True
app.config['PERMANENT_SESSION_LIFETIME'] = 3600  # 1 hora
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = False  # Alterar para True se usar HTTPS
app.config['SESSION_FILE_DIR'] = os.path.join(os.getcwd(), 'flask_session')
app.config['SESSION_COOKIE_DOMAIN'] = '127.0.0.1'  # Definir explicitamente o domínio
Session(app)

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
        funcionarios = execute_supabase_query(
            supabase.table('funcionarios').select('*').eq('id', session['user_id'])
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
            return jsonify({'user': funcionario, 'redirect': url_for('dashboard')})
        except Exception as e:
            print(f"Erro no login: {str(e)}")
            return jsonify({'error': 'Invalid login credentials'}), 401
    return render_template('login.html')

@app.route('/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    print("Usuário deslogado, sessão limpa")
    return jsonify({'message': 'Logout successful'})

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
            base_query = base_query.eq('status', status)

        if count_only:
            total_response = base_query.execute()
            total_alunos = total_response.count
            return jsonify({'total_alunos': total_alunos})

        query = supabase.table('alunos').select(
            'id, nome, matricula, polo_id, polos(nome), turma_unidade, genero, pcd, unidade, etapa, turno, data_nascimento, matriculas(turmas(disciplinas(tipo)))'
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
        if status and status.lower() != 'tudo':
            query = query.eq('status', status)

        # Carregar todos os alunos em lotes de 1000
        total_response = base_query.execute()
        total_alunos = total_response.count
        
        # Carregar os alunos em lotes
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
            cognitive_count = sum(1 for m in matriculas if m['turmas']['disciplinas']['tipo'] == 'cognitiva')
            total_count = len(matriculas)
            required_count = 4 if aluno['etapa'] in ['4º Ano', '5º Ano', '6º Ano', '7º Ano'] else 2
            status = 'pending'
            if total_count >= required_count and cognitive_count >= 1:
                status = 'complete'
            elif total_count > 0:
                status = 'partial'
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
            'total_alunos': total_alunos
        })
    except Exception as e:
        print(f"Erro em get_alunos: {str(e)}")
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
        data = request.json
        try:
            matricula = execute_supabase_query(
                supabase.table('matriculas').insert({
                    'aluno_id': data['alunoId'],
                    'turma_id': data['turmaId']
                })
            )[0]
            print(f"Nova matrícula criada: {matricula}")
            return jsonify({
                'id': matricula['id'],
                'studentId': matricula['aluno_id'],
                'classId': matricula['turma_id']
            })
        except Exception as e:
            print(f"Erro em manage_matriculas POST: {str(e)}")
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

        supabase.table('matriculas').delete().eq('id', id).execute()
        return jsonify({'message': 'Matrícula removida com sucesso'})
    except Exception as e:
        print(f"Erro em delete_matricula: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)