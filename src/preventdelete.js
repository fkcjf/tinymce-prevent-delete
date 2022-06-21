const plugin = (editor) => {
  const preventDelete = new PreventDelete(editor);
  editor.on('keydown', preventDelete.checkEvent);
  editor.on('BeforeExecCommand', (e) => {
    if (['Cut', 'Delete', 'Paste'].includes(e.command)) {
      return preventDelete.checkEvent(e);
    }
    return true;
  });

  // eslint-disable-next-line require-jsdoc
  function PreventDelete(editor) {
    const self = this;
    const rootId = editor.id;
    const userAgentCanLog =
      (typeof console !== 'undefined' && typeof console.log !== 'undefined');
    const logDebug =
      (userAgentCanLog && Boolean(editor.getParam('preventdelete_logDebug')));
    const lockChildren =
      Boolean(editor.getParam('preventdelete_lockChildren'));
    const lockParents =
      Boolean(editor.getParam('preventdelete_lockParents'));
    const preventDeleteClass =
      editor.getParam('noneditable_class');

    const spaceCharCodes = [160, 32];

    const deletingKeyCodes = [
      'Backspace',
      'Delete',
    ];

    const keysDeletingWithCtrl = [
      'x',
    ];

    const logElemProperties = [
      'innerHTML',
      'nodeName',
      'nodeType',
      'nextSibling',
      'previousSibling',
      'outerHTML',
      'parentElement',
      'data',
    ];

    /*
    // Returns whether val is within the range specified by min/max
    function inRange(val, min, max) {
      return val >= min && val <= max;
    }
    */

    // Returns whether there is any non-space characters
    // in the specified direction relative to the position

    /**
     * @param {string} str
     * @param {int} pos
     * @param {boolean} left
     * @return {boolean}
     */
    function hasText(str, pos, left) { // eslint-disable-line no-unused-vars
      left = Boolean(left);

      for (
        let i = left ? pos - 1 : pos;
        left ? i > 0 : i < str.length;
        left ? i-- : i++
      ) {
        if (spaceCharCodes.includes(str.charCodeAt(i))) {
          continue;
        } else {
          return true;
        }
      }

      return false;
    }

    // This just returns true if there is relevant text
    // that would stop ctrl back/del from propagating farther than this string
    /**
     * @param {string} str
     * @param {int} pos
     * @param {boolean} left
     * @return {boolean}
     */
    function hasStopText(str, pos, left) {
      let text = false;
      let space = false;
      left = left !== false;

      for (
        let i = left ? pos - 1 : pos;
        left ? i > 0 : i < str.length;
        left ? i-- : i++
      ) {
        const isSpace = spaceCharCodes.includes(str.charCodeAt(i));
        if (!space && isSpace) {
          space = true;
        } else if (!text && !isSpace) {
          text = true;
        }

        if (space && text) {
          return true;
        }
      }

      return false;
    }

    this.nextElement = function(elem) {
      let {nextSibling} = elem;
      while (nextSibling.length === 0) {
        elem = elem.parentElement;
        if (elem.getAttributeNode('id').value === rootId) {
          return false;
        }

        nextSibling = elem.nextSibling;
      }

      return nextSibling;
    };

    this.prevElement = function(elem) {
      let prevSibling = elem.previousSibling;
      while (prevSibling.length === 0) {
        elem = elem.parentElement;
        if (elem.getAttributeNode('id').value === rootId) {
          return false;
        }

        prevSibling = elem.previousSibling;
      }

      return prevSibling;
    };

    this.keyWillDelete = function(evt) {
      const {key} = evt;
      const {code} = evt;
      const isCtrl = evt.ctrlKey;
      let ret = false;

      // Ignore single Ctrl presses
      if (key !== 'Control') {
        if (isCtrl) {
          ret = (
            keysDeletingWithCtrl.includes(key) ||
            deletingKeyCodes.includes(code)
          );
        } else {
          ret = deletingKeyCodes.includes(code);
        }

        if (logDebug) {
          console.log(
              'keyWillDelete', ret,
              `code=${code}`, `key=${key}`, isCtrl ? 'ctrl=true' : 'ctrl=false',
          );
        }
      }

      return ret;
    };

    this.cancelKey = function(evt) {
      evt.preventDefault();
      evt.stopPropagation();
      return false;
    };

    this.check = function(node) {
      const classList = node.classList ?? null;
      if (classList === null) {
        return false;
      }

      return classList.contains(preventDeleteClass);
    };

    this.nodeParentArray = function(node, closestFirst, cutoff) {
      closestFirst = Boolean(closestFirst);
      cutoff = cutoff ?? null;

      const parents = [];
      if (Boolean(node) && Boolean(node.parentElement)) {
        let parent = node.parentElement;
        while (parent !== null) {
          if (node === cutoff) {
            break;
          }
          parents.push(node);
          node = parent;
          parent = node.parentElement;
        }
      }

      if (!closestFirst) {
        parents.reverse();
      }

      return parents;
    };

    this.querySelectorFrom = function(selector, elements) {
      return [].filter.call(elements, (element) => element.matches(selector));
    };

    this.checkParents = function(node) {
      if (!node) {
        return false;
      }

      const nodeParents = self.nodeParentArray(node);
      const filteredParents =
        self.querySelectorFrom(`.${preventDeleteClass}`, nodeParents);
      return (filteredParents.length > 0);
    };

    this.checkChildren = function(node) {
      if (!node || !node.querySelectorAll) {
        return false;
      }

      const filteredChildren = node.querySelectorAll(`.${preventDeleteClass}`);
      return (filteredChildren.length > 0);
    };

    this.logElem = function(elem) {
      const e = {};

      logElemProperties.forEach(
          (property) => {
            e[property] = elem[property];
          },
      );

      if (logDebug) {
        console.log(e);
      }
    };

    this.checkEvent = function(evt) {
      /**
       * Skip if the event is a keypress that doesn't delete
       */
      if (!self.keyWillDelete(evt)) {
        return true;
      }

      /**
       * Check selection node for preventDelete class,
       * check the selection node's children if the option lockParents is set,
       * check the selection node's parents if the option lockChildren is set.
       * (This last option is probably redundant
       *  as it is probably already covered by the first.)
       */
      const selected = editor.selection.getNode();
      const checkConditions = {
        check: self.check(selected),
        checkChildren:
          (lockParents === false) ? false : self.checkChildren(selected),
        checkParents:
          (lockChildren === false) ? false : self.checkParents(selected),
      };
      const checkResult = (
        checkConditions.check ||
        checkConditions.checkChildren ||
        checkConditions.checkParents
      );
      if (logDebug) {
        console.log('check', selected, checkResult, checkConditions);
      }

      if (checkResult) {
        if (logDebug) {
          console.log('selection node preventDelete class match');
        }

        return self.cancelKey(evt);
      }

      const range = editor.selection.getRng();
      if (logDebug) {
        console.log('range', range);
      }

      /*
      Self.logElem(range.startContainer)
      */

      const back = evt.code && evt.code === 'Backspace';
      const del = evt.code && evt.code === 'Delete';

      const noselection = (range.startContainer === range.endContainer);

      let conNoEdit = false;
      if (!noselection) {
        // Ensure nothing in the span between elems is noneditable

        const startParents = self.nodeParentArray(
            range.startContainer, false, range.commonAncestorContainer);

        const endParents = self.nodeParentArray(
            range.endContainer, false, range.commonAncestorContainer);

        for (
          let part = startParents[0];
          !conNoEdit && part;
          part = part.nextSibling
        ) {
          const check = self.check(part) || self.checkChildren(part);
          if (check) {
            conNoEdit = check;
          }

          if (endParents[0] === part) {
            break;
          }
        }
      }

      if (conNoEdit) {
        if (logDebug) {
          console.log('conNoEdit', conNoEdit);
        }

        return self.cancelKey(evt);
      }

      const endData = (range.endContainer.data || '');
      const zwnbsp = (
        range.startContainer.data &&
        range.startContainer.data.charCodeAt(0) === 65279
      );

      const delin = (
        del && range.endContainer.data &&
        range.endOffset < endData.length &&
        !(zwnbsp && endData.length === 1)
      );
      const backin = (
        back && range.startContainer.data && range.startOffset > zwnbsp
      );

      const ctrlDanger = (
        evt.ctrlKey && (back || del) &&
        !hasStopText(range.startContainer.data, range.startOffset, back)
      );

      if (delin || backin) {
        // Allow the delete
        if (!ctrlDanger) {
          return true;
        }
      }

      // If ctrl is a danger we need to skip this block
      // and check the siblings which is done in the rest of this function
      if (!ctrlDanger) {
        if (
          del && noselection &&
          (range.startOffset + 1) < range.endContainer.childElementCount
        ) {
          const elem = range.endContainer.childNodes[range.startOffset + 1];
          if (self.check(elem)) {
            if (logDebug) {
              console.log('');
            }

            return self.cancelKey(evt);
          }

          return true;
        }
      }

      // Keypress was del and will affect the next element
      if (del) {
        const next = self.nextElement(range.endContainer);
        // No next element, so we don't need to delete anyway
        if (!next) {
          if (logDebug) {
            console.log('delete key, but no next element is present');
          }

          return self.cancelKey(evt);
        }

        if (self.check(next) || self.checkChildren(next)) {
          if (logDebug) {
            console.log('delete key affects next element');
          }

          return self.cancelKey(evt);
        }
      }

      // Keypress was back and will affect the previouselement
      if (back) {
        const prev = self.prevElement(range.startContainer);
        if (self.check(prev)) {
          if (logDebug) {
            console.log('backspace key affects previous element');
          }

          return self.cancelKey(evt);
        }

        if (range.collapsed) {
          if (typeof prev.prevObject[0].className !== 'undefined') {
            if (prev.prevObject[0].className === 'mceEditable') {
              if (logDebug) {
                console.log(
                    'range is empty, previous element has mceEditable class',
                );
              }

              return self.cancelKey(evt);
            }
          }
        }

        if (self.check(prev)) {
          if (logDebug) {
            console.log('');
          }

          return self.cancelKey(evt);
        }
      }
    };
  }
};

export default plugin;
