import assert from 'assert';

import sanctuary from 'sanctuary';

import {Flag, Option, Left, Right, Pair, parseArgs} from '../index.js';


const {
  Just,
  Nothing,
  equals,
  show,
} = sanctuary;

//    eq :: a -> a -> Undefined !
const eq = actual => expected => {
  assert.strictEqual (show (actual), show (expected));
  assert.strictEqual (equals (actual) (expected), true);
};

//    type Options = { color :: Boolean
//                   , email :: Maybe String
//                   , words :: Array String }

//    defaultOptions :: Options
const defaultOptions = {
  color: false,
  email: Nothing,
  words: [],
};

//    color :: Either (Options -> Options) (String -> Either String (Options -> Options))
const color = Flag (options => ({...options, color: true}));

//    email :: Either (Options -> Options) (String -> Either String (Options -> Options))
const email = Option (email =>
  email.includes ('@')
  ? Right (options => ({...options, email: Just (email)}))
  : Left (`${show (email)} is not a valid email address`)
);

//    words :: Either (Options -> Options) (String -> Either String (Options -> Options))
const words = Option (word =>
  Right (options => ({...options, words: [...options.words, word]}))
);

//    updaters :: StrMap (Either (Options -> Options) (String -> Either String (Options -> Options)))
const updaters = {
  '-c': color, '--color': color, '--colour': color,
  '-e': email, '--email': email,
  '-w': words, '--word': words,
};

//    parse :: Array String -> Either String (Pair Options (Array String))
const parse = args => parseArgs (updaters) (Pair (defaultOptions) (args));

test ('[success] no arguments', () => {
  eq (parse ([]))
     (Right (Pair ({color: false, email: Nothing, words: []})
                  ([])));
});

test ('[success] long options', () => {
  eq (parse (['--color']))
     (Right (Pair ({color: true, email: Nothing, words: []})
                  ([])));

  eq (parse (['--colour']))
     (Right (Pair ({color: true, email: Nothing, words: []})
                  ([])));

  eq (parse (['--email', 'mail@example.org']))
     (Right (Pair ({color: false, email: Just ('mail@example.org'), words: []})
                  ([])));

  eq (parse (['--email', 'xxx@example.org', '--email', 'mail@example.org']))
     (Right (Pair ({color: false, email: Just ('mail@example.org'), words: []})
                  ([])));

  eq (parse (['--word', 'foo']))
     (Right (Pair ({color: false, email: Nothing, words: ['foo']})
                  ([])));

  eq (parse (['--word', 'foo', '--word', 'bar']))
     (Right (Pair ({color: false, email: Nothing, words: ['foo', 'bar']})
                  ([])));

  eq (parse (['--word', 'foo', '--word', 'bar', '--word', 'baz']))
     (Right (Pair ({color: false, email: Nothing, words: ['foo', 'bar', 'baz']})
                  ([])));

  eq (parse (['--word', 'foo', '--color', '--word', 'bar', '--email', 'mail@example.org', '--word', 'baz']))
     (Right (Pair ({color: true, email: Just ('mail@example.org'), words: ['foo', 'bar', 'baz']})
                  ([])));

  eq (parse (['--word', '--']))
     (Right (Pair ({color: false, email: Nothing, words: ['--']})
                  ([])));

  eq (parse (['--word', '--color']))
     (Right (Pair ({color: false, email: Nothing, words: ['--color']})
                  ([])));
});

test ('[success] short options (separate)', () => {
  eq (parse (['-c', '-e', 'mail@example.org', '-w', 'foo', '-w', 'bar', '-w', 'baz']))
     (Right (Pair ({color: true, email: Just ('mail@example.org'), words: ['foo', 'bar', 'baz']})
                  ([])));

  eq (parse (['-e', 'xxx@example.org', '--email', 'mail@example.org']))
     (Right (Pair ({color: false, email: Just ('mail@example.org'), words: []})
                  ([])));

  eq (parse (['--email', 'xxx@example.org', '-e', 'mail@example.org']))
     (Right (Pair ({color: false, email: Just ('mail@example.org'), words: []})
                  ([])));

  eq (parse (['-w', 'short', '--word', 'long', '-w', 'short', '--word', 'long']))
     (Right (Pair ({color: false, email: Nothing, words: ['short', 'long', 'short', 'long']})
                  ([])));

  eq (parse (['-w', '--']))
     (Right (Pair ({color: false, email: Nothing, words: ['--']})
                  ([])));

  eq (parse (['-w', '-c']))
     (Right (Pair ({color: false, email: Nothing, words: ['-c']})
                  ([])));
});

test ('[success] short options (grouped)', () => {
  eq (parse (['-ce', 'mail@example.org']))
     (Right (Pair ({color: true, email: Just ('mail@example.org'), words: []})
                  ([])));
});

test ('[success] positional arguments', () => {
  eq (parse (['foo']))
     (Right (Pair ({color: false, email: Nothing, words: []})
                  (['foo'])));

  eq (parse (['foo', 'bar']))
     (Right (Pair ({color: false, email: Nothing, words: []})
                  (['foo', 'bar'])));

  eq (parse (['foo', 'bar', 'baz']))
     (Right (Pair ({color: false, email: Nothing, words: []})
                  (['foo', 'bar', 'baz'])));

  eq (parse (['foo', 'bar', 'baz', '-']))
     (Right (Pair ({color: false, email: Nothing, words: []})
                  (['foo', 'bar', 'baz', '-'])));

  eq (parse (['foo', 'bar', 'baz', '--']))
     (Right (Pair ({color: false, email: Nothing, words: []})
                  (['foo', 'bar', 'baz', '--'])));

  eq (parse (['--']))
     (Right (Pair ({color: false, email: Nothing, words: []})
                  ([])));

  eq (parse (['--', 'foo']))
     (Right (Pair ({color: false, email: Nothing, words: []})
                  (['foo'])));

  eq (parse (['--', 'foo', 'bar']))
     (Right (Pair ({color: false, email: Nothing, words: []})
                  (['foo', 'bar'])));

  eq (parse (['--', 'foo', 'bar', 'baz']))
     (Right (Pair ({color: false, email: Nothing, words: []})
                  (['foo', 'bar', 'baz'])));

  eq (parse (['--', '-', '--', '---']))
     (Right (Pair ({color: false, email: Nothing, words: []})
                  (['-', '--', '---'])));

  eq (parse (['--', '--color', '--email', 'mail@example.org', '--word', 'foo']))
     (Right (Pair ({color: false, email: Nothing, words: []})
                  (['--color', '--email', 'mail@example.org', '--word', 'foo'])));

  eq (parse (['--', '--foo', '--bar', '--baz']))
     (Right (Pair ({color: false, email: Nothing, words: []})
                  (['--foo', '--bar', '--baz'])));

  eq (parse (['--', '-x', '-y', '-z']))
     (Right (Pair ({color: false, email: Nothing, words: []})
                  (['-x', '-y', '-z'])));

  eq (parse (['--', '-']))
     (Right (Pair ({color: false, email: Nothing, words: []})
                  (['-'])));
});

test ('[failure] unrecognized long options', () => {
  eq (parse (['--foo']))
     (Left ('--foo is unrecognized'));

  eq (parse (['--foo', '--bar']))
     (Left ('--foo is unrecognized'));

  eq (parse (['--color', '--foo']))
     (Left ('--foo is unrecognized'));

  eq (parse (['--bar', '--color']))
     (Left ('--bar is unrecognized'));
});

test ('[failure] lonely dash', () => {
  eq (parse (['-']))
     (Left ('- is not a valid flag or option name'));
});

test ('[failure] unrecognized short options (separate)', () => {
  eq (parse (['-d', '-c']))
     (Left ('-d is unrecognized'));

  eq (parse (['-c', '-d']))
     (Left ('-d is unrecognized'));

  eq (parse (['-X']))
     (Left ('-X is unrecognized'));

  eq (parse (['-0']))
     (Left ('-0 is unrecognized'));
});

test ('[failure] unrecognized short options (grouped)', () => {
  eq (parse (['-dc']))
     (Left ('-d is unrecognized'));

  eq (parse (['-cd']))
     (Left ('-d is unrecognized'));
});

test ('[failure] unspecified long options', () => {
  eq (parse (['--email']))
     (Left ('--email requires a value'));

  eq (parse (['--word']))
     (Left ('--word requires a value'));
});

test ('[failure] unspecified short options (separate)', () => {
  eq (parse (['-c', '-e']))
     (Left ('-e requires a value'));
});

test ('[failure] unspecified short options (grouped)', () => {
  eq (parse (['-ce']))
     (Left ('-e requires a value'));

  eq (parse (['-ec']))
     (Left ('-e requires a value'));
});

test ('[failure] invalid long option values', () => {
  eq (parse (['--email', '--color']))
     (Left ('"--color" is not a valid email address'));

  eq (parse (['--email', '--color', '--xxx']))
     (Left ('"--color" is not a valid email address'));
});

test ('[failure] invalid short option values', () => {
  eq (parse (['-e', '-c']))
     (Left ('"-c" is not a valid email address'));

  eq (parse (['-e', '-c', '-x']))
     (Left ('"-c" is not a valid email address'));
});
