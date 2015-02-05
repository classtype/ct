//--------------------------------------------------------------------------------------------------

var dump = (function() {
    var red = '\033[31m';
    var blue = '\033[34m';
    var green = '\x1b[32m';
    var yellow = '\x1b[33m';
    var reset = '\033[0m';
    
    var header = function(message) {
        console.log(blue);
        console.log(message, green);
    };
    var content = function(message) {
        console.log(message);
    };
    
    return function(obj) {
        console.log(blue);
        console.log('----------------------------------------------------------------------------');
        
        header('Console.log:');
        content(obj);
        
        if (typeof obj == 'function' || typeof obj == 'object') {
            header('For in:');
            var msg = '---';
            for (var field in obj) {
                if (msg == '---') {
                    msg = field;
                } else {
                    msg += "\n"+''+field;
                }
            }
            content(msg);
            
            header('Keys:');
            content(Object.keys(obj));
            
            header('GetOwnPropertyNames:');
            content(Object.getOwnPropertyNames(obj));
            
            header('GetPrototypeOf:');
            content(Object.getPrototypeOf(obj));
        }
    };
})();

//--------------------------------------------------------------------------------------------------

var CT = CT || (function() {
    
/*--------------------------------------------------------------------------------------------------
|
| -> Копирует метод или свойство
|
|-------------------------------------------------------------------------------------------------*/

    var copy = function(parent, child, field, warp) {
    // Получаем родительские геттер и сеттер
        var getter = parent.__lookupGetter__(field);
        var setter = parent.__lookupSetter__(field);
        
    // Проверяем наличие геттера и сеттера
        if (getter || setter) {
            if (getter) child.__defineGetter__(field, warp ? warp(getter) : getter);
            if (setter) child.__defineSetter__(field, warp ? warp(setter) : setter);
        }
        
    // Обычный метод или свойство
        else child[field] = warp ? warp(parent[field]) : parent[field];
    };
    
/*--------------------------------------------------------------------------------------------------
|
| -> Проверяет наличие в объекте функции, геттера или сеттера
|
|-------------------------------------------------------------------------------------------------*/
    
    var isMethod = function(obj, field) {
    // Функция
        if (typeof obj[field] == 'function') return true;
        
    // Геттер
        if (obj.__lookupGetter__(field)) return true;
        
    // Сеттер
        if (obj.__lookupSetter__(field)) return true;
        
    // В объекте obj поле field не является не функцией, не геттером и не сеттером
        return false;
    };
    
/*--------------------------------------------------------------------------------------------------
|
| -> Преобразовает из исходного во внутренне представление (для поиска и переопределения)
|
|-------------------------------------------------------------------------------------------------*/
    
    var parse = function(args) {
    // Методы и свойства
        var p = [
        // Статика
            {},// Список типов доступа
            {},// Список методов и свойств
            
        // Динамика
            {},// Список типов доступа
            {}// Список методов и свойств
        ];
        
    // Список типов доступа
        var types = {
            public: 0,// Публичные
            protected: 1,// Защищенные
            private: 2// Приватные
        };
        
    // Проходим по списку методов и свойств
        for (var i = 0; i < args.length; i++) {
        // Тип доступа (public/protected/private)
            for (var type in args[i]);
            
        // Статика
            if (type == 'static') {
            // Тип доступа (public/protected/private)
                for (var typeStatic in args[i][type]);
                
            // Название метода
                for (var field in args[i][type][typeStatic]);
                
            // Сохраняем тип доступа
                p[0][field] = types[typeStatic];
                
            // Копируем метод или свойство
                copy(args[i][type][typeStatic], p[1], field);
            }
            
        // Динамика
            else {
            // Название метода
                for (var field in args[i][type]);
                
            // Сохраняем тип доступа
                p[2][field] = types[type];
                
            // Копируем метод или свойство
                copy(args[i][type], p[3], field);
            }
        }
        
    // Возвращаем внутренне представление (для поиска и переопределения)
        return p;
    };
    
/*--------------------------------------------------------------------------------------------------
|
| -> Преобразовает из исходного во внутренне представление (для конечного пользования)
|
|-------------------------------------------------------------------------------------------------*/

    var getParams = function(child) {
    // Список параметров
        var p = [
        // Статика
            [
            // Методы
                {},// Публичные
                {},// Защищенные
                {}// Приватные
            ],
            [
            // Свойства
                {},// Публичные
                {},// Защищенные
                {}// Приватные
            ],
            
        // Динамика
            [
            // Методы
                {},// Публичные
                {},// Защищенные
                {}// Приватные
            ],
            [
            // Свойства
                {},// Публичные
                {},// Защищенные
                {}// Приватные
            ]
        ];
        
    // Проходим по статике и динамике
        for (var i = 0; i <= 2; i += 2) {
        // Проходим по списку методов и свойств
            for (var field in child[1 + i]) {
            // Копируем метод
                if (isMethod(child[1 + i], field)) {
                    copy(child[1 + i], p[i][child[i][field]], field);
                }
                
            // Копируем свойство
                else {
                    copy(child[1 + i], p[1 + i][child[i][field]], field);
                }
            }
        }
        
    // Возвращаем внутренне представление (для конечного пользования)
        return p;
    };
    
/*--------------------------------------------------------------------------------------------------
|
| -> Переопределяет методы или свойства для одного типа доступа
|
|-------------------------------------------------------------------------------------------------*/
    
    var extendType = function(parent, child, warp) {
    // Проходим по списку свойств
        for (var field in parent) {
        // Копируем свойство
            copy(parent, child, field, warp);
        }
    };
    
/*--------------------------------------------------------------------------------------------------
|
| -> Переопределяет методы или свойства для нескольких типов доступа
|
|-------------------------------------------------------------------------------------------------*/
    
    var extendTypes = function(parent, child) {
    // Проходим по списку типов доступа
        for (var i = 0; i < parent.length; i++) {
        // Проходим по списку методов
            extendType(parent[i], child);
        }
    };
    
/*--------------------------------------------------------------------------------------------------
|
| -> Добавляет список статических методов и свойств в Self и Private
|
|-------------------------------------------------------------------------------------------------*/
    
    var extendStatic = function(Self, Private, params) {
    // Создаем объект для статических методов и свойств
        var _self = {};
        
    // Добавляем свойство self
    // для доступа к статическим методам и свойствам
        Object.defineProperty(_self, 'self', {
            value: _self
        });
        
    // Добавляем свойство self к прототипу класса Private
    // для доступа к статическим приватным методам и свойствам
    // через все прототипные методы, геттеры, сеттеры и публичные свойства
        Object.defineProperty(Private.prototype, 'self', {
            value: _self
        });
        
    // Добавляем список методов к свойству self прототипу класса Private
    // Типы доступа: Публичные, Защищенные, Приватные
        extendTypes(params[0], Private.prototype.self);
        
    // Добавляем список свойств к свойству self прототипу класса Private
    // Типы доступа: Публичные, Защищенные, Приватные
        extendTypes(params[1], Private.prototype.self);
        
    // Добавляем список публичных статических методов к классу Self
    // Типы доступа: Публичные
        extendType(params[0][0], Self, function(method) {
            return function() {
                return method.apply(_self, arguments);
            }
        });
        
    // Проходим по списку свойств
        for (var field in params[1][0]) {
        // Перевод свойства в геттер и сеттер
            (function(field) {
                Self.__defineGetter__(field, function() {
                    return _self[field];
                });
                Self.__defineSetter__(field, function(val) {
                    _self[field] = val;
                });
            })(field);
        }
    };
    
/*--------------------------------------------------------------------------------------------------
|
| -> Добавляет список методов и свойств к прототипам классов Self и Private
|
|-------------------------------------------------------------------------------------------------*/
    
    var extendPrototype = function(Self, Private, params, privateField, pass) {
    // Добавляем список публичных методов к прототипу класса Self
    // Типы доступа: Публичные
        extendType(params[2][0], Self.prototype, function(method) {
            return function() {
                return method.apply(this[privateField](pass), arguments);
            }
        });
        
    // Добавляем список публичных свойств к прототипу класса Self
    // Типы доступа: Публичные
        for (var field in params[3][0]) {
        // Перевод свойства в геттер и сеттер
            (function(field) {
                Self.prototype.__defineGetter__(field, function() {
                    return this[privateField](pass)[field];
                });
                Self.prototype.__defineSetter__(field, function(val) {
                    this[privateField](pass)[field] = val;
                });
            })(field);
        }
        
    // Добавляем список методов к прототипу класса Private
    // Типы доступа: Публичные, Защищенные, Приватные
        extendTypes(params[2], Private.prototype);
    };
    
/*--------------------------------------------------------------------------------------------------
|
| -> Переопределяет методы
|
|-------------------------------------------------------------------------------------------------*/

    var extend = function(parent, child, type) {
    // Проходим по статике и динамике
        for (var i = 0; i <= 2; i += 2) {
        // Проходим по списку методов и свойств
            for (var field in parent[1 + i]) {
            // Отсеиваем методы и свойства ненужного типа доступа
                if (parent[i][field] == type) continue;
                
            // Отсеиваем методы и свойства
            // которые уже присутствуют в child
                if (field in child[i]) continue;
                
            // Сохраняем тип доступа
                child[i][field] = parent[i][field];
                
            // Копируем метод
                copy(parent[1 + i], child[1 + i], field);
            }
        }
    };
    
/*--------------------------------------------------------------------------------------------------
|
| -> Конструктор нового класса
|
|-------------------------------------------------------------------------------------------------*/

    var constructor = function(params, parent) {
    // Название скрытого свойства
    // для доступа к приватным методам и свойствам
        var privateField = Math.random();
        
    // Пароль для доступа к приватным методам и свойствам
        var pass = Math.random();
        
    // Класс для приватных методов и свойств
        var Private = function() {};
        
    // Конструктор нового класса
        var Self = function() {
        // Создаем экземпляр класса для приватных методов и свойств
            var _private = new Private();
            
        // Добавляем список свойств к обьекту _private
        // Типы доступа: Публичные, Защищенные, Приватные
            extendTypes(params[3], _private);
            
        // Добавляем скрытое свойство к обьекту this
        // для доступа к приватным методам и свойствам
        // через все прототипные методы, геттеры, сеттеры и публичные свойства
            Object.defineProperty(this, privateField, {value: function(val) {
            // Проверяем пароль
                if (val == pass) {
                // Возвращаем приватные методы и свойства
                    return _private;
                }
            }});
            
        // Добавляем свойство к обьекту this
        // для доступа к приватным методам и свойствам
        // через все прототипные методы, геттеры, сеттеры и публичные свойства
            this[privateField] = function(val) {
            // Проверяем пароль
                if (val == pass) {
                // Возвращаем приватные методы и свойства
                    return _private;
                }
            };
            
        // Пользовательский конструктор
            if (typeof _private.constructor == 'function') {
                _private.constructor.apply(_private, arguments);
            }
        };
        
    // Добавляем список статических методов и свойств в Self и Private
        extendStatic(Self, Private, params);
        
    // Добавляем список методов и свойств к прототипам классов Self и Private
        extendPrototype(Self, Private, params, privateField, pass);
        
    // Трейт
        Self['trait'] = function() {
        // Преобразоваем из исходного во внутренне представление
        // для поиска и переопределения
            var child = parse(arguments);
            
        // Добавляем новые или переопределяем унаследованные методы и свойства родителя
        // Типы доступа: Публичные, Защищенные, Приватные
            extend(parent, child, -1);
            
        // Преобразоваем из исходного во внутренне представление
        // для конечного пользования
            params = getParams(child);
            
        // Добавляем список методов и свойств к прототипам классов Self и Private
            extendPrototype(Self, Private, params, privateField, pass);
        };
        
    // Наследование
        Self['extend'] = function() {
        // Преобразоваем из исходного во внутренне представление
        // для поиска и переопределения
            var child = parse(arguments);
            
        // Добавляем новые или переопределяем унаследованные методы и свойства родителя
        // Типы доступа: Публичные, Защищенные
            extend(parent, child, 2);
            
        // Возвращаем конструктор нового класса
            return constructor(getParams(child), child);
        };
        
    // Возвращаем текущий класс
        return Self;
    };
    
/*--------------------------------------------------------------------------------------------------
|
| -> Наследование
|
|-------------------------------------------------------------------------------------------------*/

    return {
        extend: function() {
        // Преобразоваем из исходного во внутренне представление
        // для поиска и переопределения
            var child = parse(arguments);
            
        // Возвращаем конструктор нового класса
            return constructor(getParams(child), child);
        }
    };
})();

//--------------------------------------------------------------------------------------------------

var MyClass = CT.extend(
    {public: {bar1: 'bar1'}},
    {protected: {bar2: 'bar2'}},
    {private: {bar3: 'bar3'}},
    {public: {myMethod: function() {
        return {
            foo1: this.bar1,
            foo1: this.bar1,
            foo1: this.bar1,
            bar1: this.bar1,
            bar2: this.bar2,
            bar3: this.bar3
        };
    }}}
);

console.log(MyClass);

//--------------------------------------------------------------------------------------------------