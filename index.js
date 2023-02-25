//. # sanctuary-argv
//.
//. The JavaScript ecosystem has many libraries for parsing command-line
//. arguments; sanctuary-argv differs from these in a few important ways.
//.
//. ## Philosophy
//.
//. sanctuary-argv is completely pure. It does not:
//.
//.   - reference global variables (such as `process.argv`);
//.
//.   - read from standard input;
//.
//.   - write to standard output or standard error;
//.
//.   - mutate its arguments; or
//.
//.   - throw exceptions.
//.
//. ## Terminology
//.
//. The following section dissects a `cut` command to name the various parts:
//.
//.     cut -s -d : -f 1 -- file1 file2 file3   = command
//.
//.         -s -d : -f 1 -- file1 file2 file3   = arguments
//.
//.         -s                                  = flags = flag names
//.
//.            -d : -f 1                        = options
//.
//.            -d   -f                          = option names
//.
//.               :    1                        = option values
//.
//.                      --                     = separator
//.
//.                         file1 file2 file3   = positional arguments
//.
//. ### Design decisions
//.
//.   - There are no implicit flags or options. If the command-line interface
//.     is to support `--help`, for example, sanctuary-argv does not generate
//.     the help text.
//.
//.   - Both long option names (e.g. `--extension`) and short option names
//.     (e.g. `-x`) are supported.
//.
//.   - Short option names and long option names must be specified separately
//.     (whereas [Commander.js][] supports `'-x, --extension <extension>'`).
//.
//.   - If a long option name has an associated value, the value must be
//.     provided as a separate argument (e.g. `['--extension', '.js']`).
//.     `--name=value`-style options are not supported.
//.
//.   - If a short option name has an associated value, the value must be
//.     provided as a separate argument (e.g. `['-x', '.js']`).
//.
//.   - Multiple short flag names may be provided together, with up
//.     to one short option name. `tar -zxvf filename` is short for
//.     `tar -z -x -v -f filename`.
//.
//. [Commander.js]: https://github.com/tj/commander.js
//.
//. ## Algorithm
//.
//. There are three inputs:
//.
//.   - a _specification_, a mapping from flag/option name to handler;
//.   - an arbitrary _configuration value_; and
//.   - an array of _arguments_.
//.
//. There are two outputs:
//.
//.   - a _configuration value_; and
//.   - an array of _positional arguments_.
//.
//. The separator consists of two hyphens (`/^--$/`).
//.
//. Short flag/option names consist of a hyphen followed by a non-hyphen
//. character (`/^-[^-]$/`).
//.
//. Long flag/option names consist of two hyphens followed by one or more
//. characters (`/^--[^]+$/`).
//.
//. Arguments are processed from left to right. For each argument, there are
//. four possibilities:
//.
//.   - The argument is the separator. Processing ends and the current
//.     configuration value is returned along with the remaining arguments.
//.
//.   - The argument consists of a hyphen followed by multiple non-hyphen
//.     characters (`/^-[^-]{2,}$/`). The non-hyphen characters are split
//.     into separate hyphen-prefixed short flag/option names, which are
//.     processed from left to right (before the remaining arguments).
//.
//.   - The argument is a (short/long) flag/option name. It is looked up in the
//.     specification. There are three possibilities:
//.
//.       - The specification does not contain such a key. Processing ends and
//.         an error value is returned.
//.
//.       - The corresponding value is a `Flag (f)`. `f` is applied to the
//.         current configuration value to produce a new configuration value,
//.         and processing continues with the next argument.
//.
//.       - The corresponding value is an `Option (g)`. The next argument is
//.         the option value. There are two possibilities:
//.
//.           - There are no more arguments. Processing ends and an error value
//.             is returned.
//.
//.           - The validation function `g` is applied to the next argument.
//.             There are two possibilities:
//.
//.               - `g` returns an error value. Processing ends and the error
//.                 value is returned.
//.
//.               - `g` returns a function `f`. `f` is applied to the current
//.                 configuration value to produce a new configuration value,
//.                 and processing continues with the argument following the
//.                 option value.
//.
//.   - The argument is neither the separator nor a (short/long) flag/option
//.     name. Processing ends and the current configuration value is returned
//.     along with this argument and the remaining arguments.
//.
//. If, after processing the final argument, processing has not already ended,
//. the current configuration value is returned along with an empty array.

import $ from 'sanctuary-def';
import Either from 'sanctuary-either';
import Pair from 'sanctuary-pair';

const {Left, Right} = Either;

const def = $.create ({checkTypes: true, env: $.env});

const a = $.TypeVariable ('a');

//# Setter :: Type -> Type
//.
//. `Setter a` is a type alias for `a -> a`. Functions of this type are used
//. when specifying flags.
const Setter = a => $.Fn (a) (a);

//# Validator :: Type -> Type
//.
//. `Validator a` is a type alias for `String -> Either String (Setter a)`.
//. Functions of this type are used when specifying options.
const Validator = a => $.Fn ($.String) ($.Either ($.String) (Setter (a)));

//# Handler :: Type -> Type
//.
//. `Handler a` is a type alias for `Either (Setter a) (Validator a)`.
const Handler = a => $.Either (Setter (a)) (Validator (a));

//# Flag :: Setter a -> Handler a
//.
//. `Handler a` is a type alias for `Either (Setter a) (Validator a)`, so
//. `Left (setter)` creates a `Handler a` value from a `Setter a` value.
//. `Flag` is an alias for `Left`, facilitating more descriptive code.
const Flag = def ('Flag') ({}) ([Setter (a), Handler (a)]) (Left);

//# Option :: Validator a -> Handler a
//.
//. `Handler a` is a type alias for `Either (Setter a) (Validator a)`, so
//. `Right (validator)` creates a `Handler a` value from a `Validator a`
//. value. `Option` is an alias for `Right`, facilitating more descriptive
//. code.
const Option = def ('Option') ({}) ([Validator (a), Handler (a)]) (Right);

//# parseArgs :: StrMap (Handler a) -> Pair a (Array String) -> Either String (Pair a (Array String))
//.
//. The first argument is a mapping from flag/option name to handler.
//.
//. The second argument is a pair comprising the default configuration value
//. and the array of command-line arguments.
//.
//. The return value is either:
//.
//.   - an error message; or
//.
//.   - a pair comprising the final configuration value and the array of
//.     unprocessed command-line arguments (i.e. the positional arguments).
//.
//. ```javascript
//. > import Maybe from 'sanctuary-maybe'; const {Nothing, Just} = Maybe
//.
//.   //    conf :: Configuration
//. > const conf = {
//. .   color: false,
//. .   email: Nothing,
//. .   words: [],
//. . }
//.
//.   //    colorFlag :: Handler Configuration
//. > const colorFlag = Flag (conf => ({...conf, color: true}))
//.
//.   //    noColorFlag :: Handler Configuration
//. > const noColorFlag = Flag (conf => ({...conf, color: false}))
//.
//.   //    emailOption :: Handler Configuration
//. > const emailOption = Option (email =>
//. .   email.includes ('@')
//. .   ? Right (conf => ({...conf, email: Just (email)}))
//. .   : Left (JSON.stringify (email) + ' is not a valid email address')
//. . )
//.
//.   //    wordOption :: Handler Configuration
//. > const wordOption = Option (word =>
//. .   Right (conf => ({...conf, words: [...conf.words, word]}))
//. . )
//.
//.   //    spec :: StrMap (Handler Configuration)
//. > const spec = {
//. .   '-c':           colorFlag,
//. .   '--color':      colorFlag,
//. .   '--colour':     colorFlag,
//. .   '--no-color':   noColorFlag,
//. .   '--no-colour':  noColorFlag,
//. .   '-e':           emailOption,
//. .   '--email':      emailOption,
//. .   '-w':           wordOption,
//. .   '--word':       wordOption,
//. . }
//. ```
//.
//. If no command-line arguments are provided, the default configuration value
//. is returned along with an empty array of positional arguments:
//.
//. ```javascript
//. > parseArgs (spec) (Pair (conf) ([]))
//. Right (Pair ({color: false, email: Nothing, words: []}) ([]))
//. ```
//.
//. Specifying `--color` sets `color` to `true`:
//.
//. ```javascript
//. > parseArgs (spec) (Pair (conf) (['--color']))
//. Right (Pair ({color: true, email: Nothing, words: []}) ([]))
//. ```
//.
//. Command-line arguments are processed from left to right:
//.
//. ```javascript
//. > parseArgs (spec) (Pair (conf) (['--color', '--no-color']))
//. Right (Pair ({color: false, email: Nothing, words: []}) ([]))
//. ```
//.
//. Unlike flags, which stand alone, each option name must be followed by a
//. value:
//.
//. ```javascript
//. > parseArgs (spec) (Pair (conf) (['--email', 'foo@bar.com']))
//. Right (Pair ({color: false, email: Just ('foo@bar.com'), words: []}) ([]))
//.
//. > parseArgs (spec) (Pair (conf) (['--email']))
//. Left ('--email requires a value')
//. ```
//.
//. The argument after an option name is always treated as that option's value:
//.
//. ```javascript
//. > parseArgs (spec) (Pair (conf) (['--word', '--color', 'foo']))
//. Right (Pair ({color: false, email: Nothing, words: ['--color']}) (['foo']))
//. ```
//.
//. Option handlers may perform validation:
//.
//. ```javascript
//. > parseArgs (spec) (Pair (conf) (['--email', 'xxx']))
//. Left ('"xxx" is not a valid email address')
//. ```
//.
//. Specifying an option multiple times is supported, and each handler defines
//. its own semantics:
//.
//. ```javascript
//. > parseArgs (spec) (Pair (conf) (['-c', '-c', '-c', '-c', '-c']))
//. Right (Pair ({color: true, email: Nothing, words: []}) ([]))
//.
//. > parseArgs (spec) (Pair (conf) (['-e', 'a@x.org', '-e', 'b@x.org']))
//. Right (Pair ({color: false, email: Just ('b@x.org'), words: []}) ([]))
//.
//. > parseArgs (spec) (Pair (conf) (['-w', 'foo', '-w', 'bar']))
//. Right (Pair ({color: false, email: Nothing, words: ['foo', 'bar']}) ([]))
//. ```
//.
//. As soon as an argument is encountered that is not a flag or an option
//. value, that argument and any subsequent arguments are returned as the
//. positional arguments (along with the final configuration value):
//.
//. ```javascript
//. > parseArgs (spec) (Pair (conf) (['--color', 'foo', 'bar']))
//. Right (Pair ({color: true, email: Nothing, words: []}) (['foo', 'bar']))
//. ```
//.
//. `--` can be used to indicate that the remaining arguments are positional:
//.
//. ```javascript
//. > parseArgs (spec) (Pair (conf) (['--color', '--', '--no-color']))
//. Right (Pair ({color: true, email: Nothing, words: []}) (['--no-color']))
//. ```
//.
//. An unrecognized flag/option name results in an error message:
//.
//. ```javascript
//. > parseArgs (spec) (Pair (conf) (['-x', '-y', '-z']))
//. Left ('-x is unrecognized')
//.
//. > parseArgs (spec) (Pair (conf) (['--xxx', '--yyy', '--zzz']))
//. Left ('--xxx is unrecognized')
//. ```
//.
//. Here is the type of `parseArgs` with type aliases expanded:
//.
//. ```haskell
//. parseArgs :: StrMap (Either (a -> a) (String -> Either String (a -> a)))
//.           -> Pair a (Array String)
//.           -> Either String (Pair a (Array String))
//. ```
//.
//. Although names can improve readability, the following example demonstrates
//. that this module's functionality is exposed via a single, pure function:
//.
//. ```javascript
//. > parseArgs
//. .   ({'--foo': Left (conf => ({...conf, foo: true})),
//. .     '--bar': Right (bar => Right (conf => ({...conf, bar: Just (bar)})))})
//. .   (Pair ({foo: false, bar: Nothing})
//. .         (['--foo', '--bar', 'baz', 'quux']))
//. Right (Pair ({foo: true, bar: Just ('baz')}) (['quux']))
//. ```
const parseArgs =
def ('parseArgs')
    ({})
    ([$.StrMap (Handler (a)),
      $.Pair (a) ($.Array ($.String)),
      $.Either ($.String) ($.Pair (a) ($.Array ($.String)))])
    (spec => ([init, args]) => {
       for (let conf = init, either, idx = 0; ; idx += 1) {
         if (idx === args.length) {
           return Right (Pair (conf) ([]));
         } else if (args[idx] === '-') {
           return Left ('- is not a valid flag or option name');
         } else if (args[idx] === '--') {
           return Right (Pair (conf) (args.slice (idx + 1)));
         } else if (!(args[idx].startsWith ('-'))) {
           return Right (Pair (conf) (args.slice (idx)));
         } else for (const name of names (args[idx])) {
           if (!(Object.prototype.propertyIsEnumerable.call (spec, name))) {
             return Left (name + ' is unrecognized');
           } else if ((either = spec[name]).isLeft) {
             conf = either.value (conf);
           } else if ((idx += 1) === args.length) {
             return Left (name + ' requires a value');
           } else if ((either = either.value (args[idx])).isLeft) {
             return either;
           } else {
             conf = either.value (conf);
           }
         }
       }
     });

//  > names ('--color')
//  ['--color']
//  > names ('-xyz')
//  ['-x', '-y', '-z']
const names = arg => (
  arg.startsWith ('--')
  ? [arg]
  : (arg.replace (/(?:)/g, '-')).match (/-[^-]/g)
);

export {
  Setter,
  Validator,
  Handler,
  Flag,
  Option,
  Left,
  Right,
  Pair,
  parseArgs,
};
