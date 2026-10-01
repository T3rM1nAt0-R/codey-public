// A deliberately small JavaScript-like language for Codey's Act 3 puzzles.
// It builds and evaluates its own AST; source text is never passed to the browser.
(function () {
  window.Codey = window.Codey || {};

  const DEFAULT_LIMITS = {
    maxSourceLength: 12000,
    maxTokens: 4000,
    maxParseDepth: 64,
    maxBlockDepth: 48,
    maxSteps: 3000,
    maxLoopIterations: 100,
    maxCallDepth: 24,
    maxOutputLength: 8192,
  };

  const HARD_LIMITS = {
    maxSourceLength: 12000,
    maxTokens: 4000,
    maxParseDepth: 64,
    maxBlockDepth: 48,
    maxSteps: 5000,
    maxLoopIterations: 200,
    maxCallDepth: 32,
    maxOutputLength: 8192,
  };

  const RESERVED = new Set([
    'let', 'var', 'const', 'function', 'if', 'else', 'for', 'return',
    'while', 'do', 'new', 'this', 'class', 'import', 'export', 'try',
    'catch', 'throw', 'typeof', 'in', 'of', 'await', 'async',
    'print', '__proto__', 'prototype', 'constructor',
  ]);

  class CodeError extends Error {
    constructor(message, token) {
      const location = token ? `Line ${token.line}, column ${token.column}: ` : '';
      super(location + message);
      this.name = 'CodeError';
      this.line = token ? token.line : 1;
      this.column = token ? token.column : 1;
    }
  }

  function safeLimits(requested) {
    const limits = {};
    Object.keys(DEFAULT_LIMITS).forEach((key) => {
      const value = requested && Number.isFinite(requested[key]) ? Math.floor(requested[key]) : DEFAULT_LIMITS[key];
      limits[key] = Math.max(1, Math.min(value, HARD_LIMITS[key]));
    });
    return limits;
  }

  class Lexer {
    constructor(source, limits) {
      this.source = source;
      this.limits = limits;
      this.index = 0;
      this.line = 1;
      this.column = 1;
      this.tokens = [];
    }

    current(offset) {
      return this.source[this.index + (offset || 0)] || '';
    }

    advance() {
      const char = this.source[this.index++];
      if (char === '\n') {
        this.line += 1;
        this.column = 1;
      } else {
        this.column += 1;
      }
      return char;
    }

    add(type, value, line, column) {
      if (this.tokens.length >= this.limits.maxTokens) {
        throw new CodeError('Program has too many tokens.', { line, column });
      }
      this.tokens.push({ type, value, line, column });
    }

    skipLineComment() {
      while (this.current() && this.current() !== '\n') this.advance();
    }

    readString(quote, line, column) {
      this.advance();
      let value = '';
      while (this.current() && this.current() !== quote) {
        const char = this.advance();
        if (char === '\n' || char === '\r') {
          throw new CodeError('String literals cannot cross lines.', { line, column });
        }
        if (char === '\\') {
          const escaped = this.advance();
          const escapes = { n: '\n', r: '\r', t: '\t', '\\': '\\', "'": "'", '"': '"' };
          if (!Object.prototype.hasOwnProperty.call(escapes, escaped)) {
            throw new CodeError(`Unsupported string escape \\ ${escaped}.`, { line: this.line, column: this.column - 1 });
          }
          value += escapes[escaped];
        } else {
          value += char;
        }
        if (value.length > this.limits.maxOutputLength) {
          throw new CodeError('String literal is too long.', { line, column });
        }
      }
      if (this.current() !== quote) throw new CodeError('Unclosed string literal.', { line, column });
      this.advance();
      this.add('string', value, line, column);
    }

    tokenize() {
      if (typeof this.source !== 'string') throw new CodeError('Program must be text.');
      if (this.source.length > this.limits.maxSourceLength) {
        throw new CodeError('Program is too long.');
      }

      while (this.current()) {
        const char = this.current();
        if (/\s/.test(char)) {
          this.advance();
          continue;
        }

        const line = this.line;
        const column = this.column;
        if (char === '/' && this.current(1) === '/') {
          this.skipLineComment();
          continue;
        }
        if (char === '/' && this.current(1) === '*') {
          throw new CodeError('Block comments are not supported; use // comments.', { line, column });
        }
        const unsupportedOperator = ['++', '--', '+=', '-=', '*=', '/=', '=>', '?.', '**'].find(
          (candidate) => this.source.slice(this.index, this.index + candidate.length) === candidate
        );
        if (unsupportedOperator) {
          throw new CodeError(`Operator "${unsupportedOperator}" is not supported; use the documented syntax.`, { line, column });
        }
        if (char === "'" || char === '"') {
          this.readString(char, line, column);
          continue;
        }
        if (/[0-9]/.test(char)) {
          let number = '';
          while (/[0-9]/.test(this.current())) number += this.advance();
          if (this.current() === '.' && /[0-9]/.test(this.current(1))) {
            number += this.advance();
            while (/[0-9]/.test(this.current())) number += this.advance();
          }
          const value = Number(number);
          if (!Number.isFinite(value)) throw new CodeError('Number is outside the supported range.', { line, column });
          this.add('number', value, line, column);
          continue;
        }
        if (/[A-Za-z_$]/.test(char)) {
          let name = '';
          while (/[A-Za-z0-9_$]/.test(this.current())) name += this.advance();
          this.add('identifier', name, line, column);
          continue;
        }

        const operator = ['===', '!==', '<=', '>=', '==', '!=', '&&', '||'].find(
          (candidate) => this.source.slice(this.index, this.index + candidate.length) === candidate
        );
        if (operator) {
          for (let i = 0; i < operator.length; i += 1) this.advance();
          this.add('operator', operator, line, column);
          continue;
        }
        if ('+-*/%<>=!'.includes(char)) {
          this.advance();
          this.add('operator', char, line, column);
          continue;
        }
        if ('(){};,'.includes(char)) {
          this.advance();
          this.add('punctuation', char, line, column);
          continue;
        }
        throw new CodeError(`Unsupported character "${char}".`, { line, column });
      }

      this.add('eof', '', this.line, this.column);
      return this.tokens;
    }
  }

  class Parser {
    constructor(tokens, limits) {
      this.tokens = tokens;
      this.limits = limits;
      this.index = 0;
      this.parseDepth = 0;
      this.blockDepth = 0;
      this.functionDepth = 0;
      this.expressionOperators = 0;
    }

    current(offset) {
      return this.tokens[this.index + (offset || 0)] || this.tokens[this.tokens.length - 1];
    }

    at(value) {
      return this.current().value === value;
    }

    match(value) {
      if (!this.at(value)) return false;
      this.index += 1;
      return true;
    }

    consume(value, message) {
      const token = this.current();
      if (!this.match(value)) throw new CodeError(message || `Expected "${value}".`, token);
      return token;
    }

    consumeIdentifier(message) {
      const token = this.current();
      if (token.type !== 'identifier' || RESERVED.has(token.value) || token.value === 'true' || token.value === 'false' || token.value === 'null') {
        throw new CodeError(message || 'Expected a variable or function name.', token);
      }
      this.index += 1;
      return token;
    }

    parseProgram() {
      const body = [];
      while (this.current().type !== 'eof') body.push(this.parseStatement());
      return { type: 'Program', body, loc: this.current() };
    }

    parseStatement() {
      if (this.match(';')) return { type: 'EmptyStatement', loc: this.current(-1) };
      if (this.at('let')) return this.parseVariableDeclaration(true);
      if (this.at('if')) return this.parseIf();
      if (this.at('for')) return this.parseFor();
      if (this.at('function')) return this.parseFunction();
      if (this.at('return')) return this.parseReturn();
      if (this.current().type === 'identifier' && this.current(1).value === '=') {
        return this.parseAssignment(true);
      }

      const loc = this.current();
      const expression = this.parseExpression();
      this.consume(';', 'Expected ";" after this statement.');
      return { type: 'ExpressionStatement', expression, loc };
    }

    parseVariableDeclaration(withSemicolon) {
      this.consume('let');
      const name = this.consumeIdentifier('Expected a name after let.');
      this.consume('=', 'Expected "=" after the variable name.');
      const initializer = this.parseExpression();
      if (withSemicolon) this.consume(';', 'Expected ";" after the variable declaration.');
      return { type: 'VariableDeclaration', name: name.value, initializer, loc: name };
    }

    parseAssignment(withSemicolon) {
      const name = this.consumeIdentifier('Expected a variable name.');
      this.consume('=', 'Expected "=" in the assignment.');
      const value = this.parseExpression();
      if (withSemicolon) this.consume(';', 'Expected ";" after the assignment.');
      return { type: 'Assignment', name: name.value, value, loc: name };
    }

    parseIf() {
      const loc = this.consume('if');
      this.consume('(', 'Expected "(" after if.');
      const test = this.parseExpression();
      this.consume(')', 'Expected ")" after the if condition.');
      const consequent = this.parseBlock();
      const alternate = this.match('else') ? this.parseBlock() : null;
      return { type: 'IfStatement', test, consequent, alternate, loc };
    }

    parseFor() {
      const loc = this.consume('for');
      this.consume('(', 'Expected "(" after for.');
      const initializer = this.parseVariableDeclaration(false);
      this.consume(';', 'Expected ";" after the for-loop initializer.');
      const test = this.parseExpression();
      this.consume(';', 'Expected ";" after the for-loop condition.');
      const update = this.parseAssignment(false);
      this.consume(')', 'Expected ")" after the for-loop update.');
      const body = this.parseBlock();
      return { type: 'ForStatement', initializer, test, update, body, loc };
    }

    parseFunction() {
      const loc = this.consume('function');
      if (this.blockDepth > 0) {
        throw new CodeError('Function declarations must be at the top level.', loc);
      }
      const name = this.consumeIdentifier('Expected a function name.');
      if (name.value === 'print') throw new CodeError('The name "print" is reserved.', name);
      this.consume('(', 'Expected "(" after the function name.');
      const params = [];
      if (!this.at(')')) {
        do {
          const param = this.consumeIdentifier('Expected a parameter name.');
          if (params.includes(param.value)) throw new CodeError('Function parameters must have unique names.', param);
          params.push(param.value);
          if (params.length > 8) throw new CodeError('Functions can have at most 8 parameters.', param);
        } while (this.match(','));
      }
      this.consume(')', 'Expected ")" after the parameters.');
      this.functionDepth += 1;
      const body = this.parseBlock();
      this.functionDepth -= 1;
      return { type: 'FunctionDeclaration', name: name.value, params, body, loc };
    }

    parseReturn() {
      const loc = this.consume('return');
      if (this.functionDepth === 0) throw new CodeError('return can only be used inside a function.', loc);
      const value = this.parseExpression();
      this.consume(';', 'Expected ";" after the return value.');
      return { type: 'ReturnStatement', value, loc };
    }

    parseBlock() {
      const loc = this.consume('{', 'Expected a block starting with "{".');
      this.blockDepth += 1;
      if (this.blockDepth > this.limits.maxBlockDepth) {
        throw new CodeError('Blocks are nested too deeply.', loc);
      }
      const body = [];
      while (!this.at('}') && this.current().type !== 'eof') body.push(this.parseStatement());
      this.consume('}', 'Expected "}" to close this block.');
      this.blockDepth -= 1;
      return { type: 'BlockStatement', body, loc };
    }

    parseExpression() {
      this.parseDepth += 1;
      if (this.parseDepth > this.limits.maxParseDepth) {
        throw new CodeError('Expressions are nested too deeply.', this.current());
      }
      const previousOperators = this.expressionOperators;
      this.expressionOperators = 0;
      try {
        return this.parseOr();
      } finally {
        this.expressionOperators = previousOperators;
        this.parseDepth -= 1;
      }
    }

    noteOperator(token) {
      this.expressionOperators += 1;
      if (this.expressionOperators > this.limits.maxParseDepth) {
        throw new CodeError('This expression has too many operations.', token);
      }
    }

    parseOr() {
      let expression = this.parseAnd();
      while (this.match('||')) {
        this.noteOperator(this.current(-1));
        expression = { type: 'LogicalExpression', operator: '||', left: expression, right: this.parseAnd(), loc: expression.loc };
      }
      return expression;
    }

    parseAnd() {
      let expression = this.parseEquality();
      while (this.match('&&')) {
        this.noteOperator(this.current(-1));
        expression = { type: 'LogicalExpression', operator: '&&', left: expression, right: this.parseEquality(), loc: expression.loc };
      }
      return expression;
    }

    parseEquality() {
      let expression = this.parseComparison();
      if (this.current().value === '==' || this.current().value === '!=') {
        throw new CodeError('Loose equality is not supported; use === or !==.', this.current());
      }
      while (['===', '!=='].includes(this.current().value)) {
        const operator = this.current().value;
        this.noteOperator(this.current());
        this.index += 1;
        expression = { type: 'BinaryExpression', operator, left: expression, right: this.parseComparison(), loc: expression.loc };
      }
      return expression;
    }

    parseComparison() {
      let expression = this.parseTerm();
      while (['<', '<=', '>', '>='].includes(this.current().value)) {
        const operator = this.current().value;
        this.noteOperator(this.current());
        this.index += 1;
        expression = { type: 'BinaryExpression', operator, left: expression, right: this.parseTerm(), loc: expression.loc };
      }
      return expression;
    }

    parseTerm() {
      let expression = this.parseFactor();
      while (['+', '-'].includes(this.current().value)) {
        const operator = this.current().value;
        this.noteOperator(this.current());
        this.index += 1;
        expression = { type: 'BinaryExpression', operator, left: expression, right: this.parseFactor(), loc: expression.loc };
      }
      return expression;
    }

    parseFactor() {
      let expression = this.parseUnary();
      while (['*', '/', '%'].includes(this.current().value)) {
        const operator = this.current().value;
        this.noteOperator(this.current());
        this.index += 1;
        expression = { type: 'BinaryExpression', operator, left: expression, right: this.parseUnary(), loc: expression.loc };
      }
      return expression;
    }

    parseUnary() {
      const operators = [];
      while (['!', '-', '+'].includes(this.current().value)) {
        operators.push(this.current());
        this.noteOperator(this.current());
        this.index += 1;
      }
      let expression = this.parsePrimary();
      for (let index = operators.length - 1; index >= 0; index -= 1) {
        const operator = operators[index];
        expression = { type: 'UnaryExpression', operator: operator.value, argument: expression, loc: operator };
      }
      return expression;
    }

    parsePrimary() {
      const token = this.current();
      if (token.type === 'number' || token.type === 'string') {
        this.index += 1;
        return { type: 'Literal', value: token.value, loc: token };
      }
      if (token.type === 'identifier') {
        this.index += 1;
        if (RESERVED.has(token.value) && token.value !== 'print') {
          throw new CodeError(`Keyword "${token.value}" is not supported here.`, token);
        }
        if (token.value === 'true') return { type: 'Literal', value: true, loc: token };
        if (token.value === 'false') return { type: 'Literal', value: false, loc: token };
        if (token.value === 'null') return { type: 'Literal', value: null, loc: token };
        if (this.match('(')) {
          const args = [];
          if (!this.at(')')) {
            do {
              args.push(this.parseExpression());
              if (args.length > 8) throw new CodeError('Calls can have at most 8 arguments.', token);
            } while (this.match(','));
          }
          this.consume(')', 'Expected ")" after function arguments.');
          return { type: 'CallExpression', name: token.value, args, loc: token };
        }
        if (token.value === 'print') throw new CodeError('print must be called with one value.', token);
        return { type: 'Identifier', name: token.value, loc: token };
      }
      if (this.match('(')) {
        const expression = this.parseExpression();
        this.consume(')', 'Expected ")" after the expression.');
        return expression;
      }
      throw new CodeError('Expected a value or expression.', token);
    }
  }

  class Environment {
    constructor(parent) {
      this.parent = parent || null;
      this.values = new Map();
    }

    declare(name, value, token) {
      if (this.values.has(name)) throw new CodeError(`"${name}" is already declared in this scope.`, token);
      this.values.set(name, value);
    }

    get(name, token) {
      if (this.values.has(name)) return this.values.get(name);
      if (this.parent) return this.parent.get(name, token);
      throw new CodeError(`Unknown variable "${name}".`, token);
    }

    assign(name, value, token) {
      if (this.values.has(name)) {
        this.values.set(name, value);
        return;
      }
      if (this.parent) {
        this.parent.assign(name, value, token);
        return;
      }
      throw new CodeError(`Cannot assign to unknown variable "${name}". Declare it with let first.`, token);
    }
  }

  class ReturnSignal {
    constructor(value) {
      this.value = value;
    }
  }

  function isPrimitive(value) {
    return value === null || typeof value === 'string' || typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value));
  }

  function truthy(value) {
    return !(value === false || value === null || value === 0 || value === '');
  }

  function display(value) {
    if (value === null) return 'null';
    if (typeof value === 'string') return value;
    return String(value);
  }

  class Evaluator {
    constructor(program, initialVariables, limits) {
      this.program = program;
      this.limits = limits;
      this.steps = 0;
      this.loopIterations = 0;
      this.callDepth = 0;
      this.output = [];
      this.outputLength = 0;
      this.functions = new Map();
      this.global = new Environment(null);

      Object.keys(initialVariables).forEach((name) => {
        if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) || RESERVED.has(name) || name === 'print') {
          throw new CodeError(`Invalid initial variable name "${name}".`);
        }
        const value = initialVariables[name];
        if (!isPrimitive(value) || (typeof value === 'string' && value.length > limits.maxOutputLength)) {
          throw new CodeError(`Initial value for "${name}" must be a short primitive value.`);
        }
        this.global.declare(name, value);
      });

      program.body.forEach((statement) => {
        if (statement.type === 'FunctionDeclaration') {
          if (this.functions.has(statement.name)) throw new CodeError(`Function "${statement.name}" is declared more than once.`, statement.loc);
          if (this.global.values.has(statement.name)) throw new CodeError(`Function "${statement.name}" conflicts with a variable.`, statement.loc);
          this.functions.set(statement.name, statement);
        }
      });
    }

    tick(token) {
      this.steps += 1;
      if (this.steps > this.limits.maxSteps) throw new CodeError('Step limit reached. Simplify the program or reduce its loops.', token);
    }

    executeBlock(block, parent) {
      const scope = new Environment(parent);
      block.body.forEach((statement) => this.execute(statement, scope));
    }

    execute(statement, scope) {
      this.tick(statement.loc);
      switch (statement.type) {
        case 'EmptyStatement':
        case 'FunctionDeclaration':
          return;
        case 'VariableDeclaration':
          if (this.functions.has(statement.name)) {
            throw new CodeError(`Variable "${statement.name}" conflicts with a function name.`, statement.loc);
          }
          scope.declare(statement.name, this.evaluate(statement.initializer, scope), statement.loc);
          return;
        case 'Assignment':
          scope.assign(statement.name, this.evaluate(statement.value, scope), statement.loc);
          return;
        case 'ExpressionStatement':
          this.evaluate(statement.expression, scope);
          return;
        case 'IfStatement':
          if (truthy(this.evaluate(statement.test, scope))) this.executeBlock(statement.consequent, scope);
          else if (statement.alternate) this.executeBlock(statement.alternate, scope);
          return;
        case 'ForStatement':
          this.executeFor(statement, scope);
          return;
        case 'ReturnStatement':
          throw new ReturnSignal(this.evaluate(statement.value, scope));
        default:
          throw new CodeError('Unsupported statement.', statement.loc);
      }
    }

    executeFor(statement, scope) {
      const loopScope = new Environment(scope);
      this.execute(statement.initializer, loopScope);
      let localIterations = 0;
      while (truthy(this.evaluate(statement.test, loopScope))) {
        localIterations += 1;
        this.loopIterations += 1;
        if (localIterations > this.limits.maxLoopIterations || this.loopIterations > this.limits.maxLoopIterations) {
          throw new CodeError('Loop limit reached. Keep each program to a small, bounded number of repetitions.', statement.loc);
        }
        this.tick(statement.loc);
        this.executeBlock(statement.body, loopScope);
        this.execute(statement.update, loopScope);
      }
    }

    evaluate(node, scope) {
      this.tick(node.loc);
      switch (node.type) {
        case 'Literal':
          return node.value;
        case 'Identifier':
          return scope.get(node.name, node.loc);
        case 'UnaryExpression': {
          const value = this.evaluate(node.argument, scope);
          if (node.operator === '!') return !truthy(value);
          if (typeof value !== 'number') throw new CodeError(`Operator ${node.operator} needs a number.`, node.loc);
          return this.finite(node.operator === '-' ? -value : value, node.loc);
        }
        case 'LogicalExpression': {
          const left = this.evaluate(node.left, scope);
          if (node.operator === '&&') return truthy(left) ? this.evaluate(node.right, scope) : left;
          return truthy(left) ? left : this.evaluate(node.right, scope);
        }
        case 'BinaryExpression':
          return this.evaluateBinary(node, scope);
        case 'CallExpression':
          return this.call(node, scope);
        default:
          throw new CodeError('Unsupported expression.', node.loc);
      }
    }

    finite(value, token) {
      if (!Number.isFinite(value)) throw new CodeError('That calculation did not produce a finite number.', token);
      return value;
    }

    evaluateBinary(node, scope) {
      const left = this.evaluate(node.left, scope);
      const right = this.evaluate(node.right, scope);
      switch (node.operator) {
        case '===': return typeof left === typeof right && left === right;
        case '!==': return !(typeof left === typeof right && left === right);
        case '<':
        case '<=':
        case '>':
        case '>=': {
          if (typeof left !== typeof right || !['number', 'string'].includes(typeof left)) {
            throw new CodeError('Comparisons need two numbers or two strings.', node.loc);
          }
          if (node.operator === '<') return left < right;
          if (node.operator === '<=') return left <= right;
          if (node.operator === '>') return left > right;
          return left >= right;
        }
        case '+':
          if (typeof left === 'string' || typeof right === 'string') {
            const joined = display(left) + display(right);
            if (joined.length > this.limits.maxOutputLength) {
              throw new CodeError('String value is too long. Keep text values within the output limit.', node.loc);
            }
            return joined;
          }
          if (typeof left !== 'number' || typeof right !== 'number') throw new CodeError('Use + with two numbers or when joining text.', node.loc);
          return this.finite(left + right, node.loc);
        case '-':
        case '*':
        case '/':
        case '%':
          if (typeof left !== 'number' || typeof right !== 'number') throw new CodeError(`Operator ${node.operator} needs two numbers.`, node.loc);
          if ((node.operator === '/' || node.operator === '%') && right === 0) throw new CodeError('Cannot divide by zero.', node.loc);
          if (node.operator === '-') return this.finite(left - right, node.loc);
          if (node.operator === '*') return this.finite(left * right, node.loc);
          if (node.operator === '/') return this.finite(left / right, node.loc);
          return this.finite(left % right, node.loc);
        default:
          throw new CodeError(`Unsupported operator "${node.operator}".`, node.loc);
      }
    }

    call(node, callerScope) {
      const args = node.args.map((argument) => this.evaluate(argument, callerScope));
      if (node.name === 'print') {
        if (args.length !== 1) throw new CodeError('print takes exactly one value.', node.loc);
        const line = display(args[0]);
        const extraLength = line.length + (this.output.length > 0 ? 1 : 0);
        if (this.outputLength + extraLength > this.limits.maxOutputLength) {
          throw new CodeError('Output limit reached. Print less text.', node.loc);
        }
        this.output.push(line);
        this.outputLength += extraLength;
        return args[0];
      }

      const fn = this.functions.get(node.name);
      if (!fn) throw new CodeError(`Unknown function "${node.name}". Only declared functions and print() can be called.`, node.loc);
      if (args.length !== fn.params.length) {
        throw new CodeError(`Function "${node.name}" expects ${fn.params.length} argument(s).`, node.loc);
      }
      this.callDepth += 1;
      if (this.callDepth > this.limits.maxCallDepth) {
        this.callDepth -= 1;
        throw new CodeError('Function call limit reached. Check for a function that calls itself too often.', node.loc);
      }
      const functionScope = new Environment(this.global);
      fn.params.forEach((param, index) => functionScope.declare(param, args[index], fn.loc));
      try {
        this.executeBlock(fn.body, functionScope);
      } catch (error) {
        if (error instanceof ReturnSignal) return error.value;
        throw error;
      } finally {
        this.callDepth -= 1;
      }
      return null;
    }

    run() {
      this.program.body.forEach((statement) => this.execute(statement, this.global));
      return this.result(true, null);
    }

    result(ok, error) {
      const variables = {};
      this.global.values.forEach((value, name) => {
        if (!this.functions.has(name)) {
          Object.defineProperty(variables, name, { value, enumerable: true, configurable: true, writable: true });
        }
      });
      return { ok, variables, output: this.output.slice(), steps: this.steps, error };
    }
  }

  function evaluate(source, options) {
    const settings = options || {};
    const limits = safeLimits(settings.limits);
    let evaluator = null;
    try {
      const tokens = new Lexer(source, limits).tokenize();
      const program = new Parser(tokens, limits).parseProgram();
      const initialVariables = settings.variables || {};
      if (!initialVariables || typeof initialVariables !== 'object' || Array.isArray(initialVariables)) {
        throw new CodeError('Initial variables must be a plain object.');
      }
      evaluator = new Evaluator(program, initialVariables, limits);
      return evaluator.run();
    } catch (error) {
      const expectedError = error instanceof CodeError ? error : new CodeError('The program could not be run safely.');
      return evaluator
        ? evaluator.result(false, expectedError.message)
        : { ok: false, variables: Object.assign({}, settings.variables || {}), output: [], steps: 0, error: expectedError.message };
    }
  }

  function matchesGoal(result, goal) {
    if (!result || !result.ok || !goal || typeof goal !== 'object') return false;
    const expectedVariables = goal.variables || {};
    if (typeof expectedVariables !== 'object' || Array.isArray(expectedVariables)) return false;
    const hasVariableGoal = Object.keys(expectedVariables).length > 0;
    const hasOutputGoal = Array.isArray(goal.outputIncludes) && goal.outputIncludes.length > 0;
    const hasExactOutputGoal = Array.isArray(goal.outputEquals);
    if (!hasVariableGoal && !hasOutputGoal && !hasExactOutputGoal) return false;
    if (Object.keys(expectedVariables).some((name) => result.variables[name] !== expectedVariables[name])) return false;
    const transcript = result.output.join('\n');
    if (goal.outputIncludes !== undefined && (!Array.isArray(goal.outputIncludes) ||
      !goal.outputIncludes.every((part) => transcript.includes(String(part))))) return false;
    if (goal.outputEquals !== undefined && (!Array.isArray(goal.outputEquals) ||
      result.output.length !== goal.outputEquals.length ||
      !goal.outputEquals.every((line, index) => result.output[index] === String(line)))) return false;
    return true;
  }

  window.Codey.interpreter = { evaluate, matchesGoal };
})();
