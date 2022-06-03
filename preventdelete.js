(function () {
  function PreventDelete () {
    const self = this

    // Returns whether val is within the range specified by min/max
    function r (val, min, max) {
      return val >= min && val <= max
    }
    // Returns whether there is any non-space characters in the specified direction relative to the position
    // eslint-disable-next-line no-unused-vars
    function hasText (str, pos, left) {
      // 160 is &nbsp, 32 is ' '
      left = left !== false

      for (let i = left ? pos - 1 : pos; left ? i > 0 : i < str.length; left ? i-- : i++) {
        if ([160, 32].includes(str.charCodeAt(i))) { continue } else { return true }
      }
      return false
    }
    // This just returns true if there is relevant text that would stop ctrl back/del from propogating farther than this string
    function hasStopText (str, pos, left) {
      let text = false
      let space = false
      left = left !== false

      for (let i = left ? pos - 1 : pos; left ? i > 0 : i < str.length; left ? i-- : i++) {
        const isSpace = [160, 32].includes(str.charCodeAt(i))
        if (!space && isSpace) { space = true } else if (!text && !isSpace) { text = true }

        if (space && text) { return true }
      }
      return false
    }

    this.root_id = 'tinymce'
    this.preventdelete_class = 'mceNonEditable'

    this.nextElement = function (elem) {
      let $elem = $(elem)
      let nextSibling = $elem.next()
      while (nextSibling.length === 0) {
        $elem = $elem.parent()
        if ($elem.attr('id') === self.root_id) { return false }

        nextSibling = $elem.next()
      }

      return nextSibling
    }
    this.prevElement = function (elem) {
      let $elem = $(elem)
      let prevSibling = $elem.prev()
      while (prevSibling.length === 0) {
        $elem = $elem.parent()
        if ($elem.attr('id') === self.root_id) { return false }

        prevSibling = $elem.prev()
      }

      return prevSibling
    }

    this.keyWillDelete = function (evt) {
      /*
      In trying to figure out how to detect if a key was relevant, I appended all the keycodes for keys on my keyboard that would "delete" selected text, and sorted.  Generated the range blow:
      Deleting
      8, 9, 13, 46, 48-57, 65-90, 96-111, 186-192, 219-222

      I did the same thign with keys that wouldn't and got these below
      Not harmful
      16-19, 27, 33-40, 45, 91-93, 112-123, 144

      You should note, since it's onkeydown it doesn't change the code if you have alt or ctrl or something pressed.  It makes it fewer keycombos actually.

      I'm pretty sure in these "deleting" keys will still "delete" if shift is held
      */

      const c = evt.keyCode

      // ctrl+x or ctrl+back/del will all delete, but otherwise it probably won't
      if (evt.ctrlKey) { return evt.key === 'x' || [8, 46].includes(c) }

      return [8, 9, 13, 46].includes(c) || r(c, 48, 57) || r(c, 65, 90) || r(c, 96, 111) || r(c, 186, 192) || r(c, 219, 222)
    }
    this.cancelKey = function (evt) {
      evt.preventDefault()
      evt.stopPropagation()
      return false
    }
    this.check = function (node) {
      return $(node).hasClass(self.preventdelete_class)
    }
    this.checkParents = function (node) {
      if (!node) { return true }

      return $(node).parents('.' + self.preventdelete_class).length > 0
    }
    this.checkChildren = function (node) {
      if (!node) { return false }

      return $(node).find('.' + self.preventdelete_class).length > 0
    }

    this.logElem = function (elem) {
      const e = {}

      const keys = ['innerHTML', 'nodeName', 'nodeType', 'nextSibling', 'previousSibling', 'outerHTML', 'parentElement', 'data']
      keys.forEach(
        function (key) {
          e[key] = elem[key]
        }
      )

      console.log(e)
    }

    this.checkEvent = function (evt) {
      if (evt.keyCode && !self.keyWillDelete(evt)) { return true }

      const selected = tinymce.activeEditor.selection.getNode()
      if (self.check(selected) || self.checkChildren(selected)) {
        return self.cancelKey(evt)
      }

      const range = tinymce.activeEditor.selection.getRng()

      /*
      self.logElem(range.startContainer)
      */

      const back = evt.keyCode && evt.keyCode === 8
      const del = evt.keyCode && evt.keyCode === 46

      let conNoEdit

      // Ensure nothing in the span between elems is noneditable
      for (let c = range.startContainer; !conNoEdit && c; c = c.nextSibling) {
        conNoEdit = conNoEdit || self.check(c)

        if (range.endContainer === c) {
          break
        }
      }

      const end = range.endContainer
      if (end && range.endOffset === 0 && (self.check(end) || self.checkChildren(end))) {
        return self.cancelKey(evt)
      }

      if (conNoEdit) {
        return self.cancelKey(evt)
      }

      const endData = range.endContainer.data || ''
      const zwnbsp = range.startContainer.data && range.startContainer.data.charCodeAt(0) === 65279

      const delin = del && range.endContainer.data && (range.endOffset < endData.length) && !(zwnbsp && endData.length === 1)
      const backin = back && range.startContainer.data && range.startOffset > zwnbsp

      const noselection = range.startOffset === range.endOffset

      const ctrlDanger = evt.ctrlKey && (back || del) && !hasStopText(range.startContainer.data, range.startOffset, back)

      if (delin || backin) {
        // Allow the delete
        if (!ctrlDanger) {
          return true
        }
      }

      // If ctrl is a danger we need to skip this block and check the siblings which is done in the rest of this function
      if (!ctrlDanger) {
        if (del && noselection && (range.startOffset + 1) < range.endContainer.childElementCount) {
          const elem = range.endContainer.childNodes[range.startOffset + 1]
          return self.check(elem) ? self.cancelKey(evt) : true
        }

        // The range is within this container
        if (range.startOffset !== range.endOffset) {
          // If this container is non-editable, cancel the event, otherwise allow the event
          return conNoEdit ? self.cancelKey(evt) : true
        }
      }

      // Keypress was del and will effect the next element
      if (del) {
        const next = self.nextElement(range.endContainer)
        // No next element, so we don't need to delete anyway
        if (!next) {
          return self.cancelKey(evt)
        }

        if (self.check(next) || self.checkChildren(next)) {
          return self.cancelKey(evt)
        }
      }
      // Keypress was back and will effect the previouselement
      if (back) {
        const prev = self.prevElement(range.startContainer)
        if (self.check(prev)) { return self.cancelKey(evt) }

        if (range.startContainer === range.endContainer) {
          if (typeof prev.prevObject[0].className !== 'undefined') {
            if (prev.prevObject[0].className === 'mceEditable') { return self.cancelKey(evt) }
          }
        }

        if (self.check(prev)) {
          return self.cancelKey(evt)
        }
      }
    }
  }

  tinymce.PluginManager.add('preventdelete', function (ed, link) {
    const preventDelete = new PreventDelete()
    ed.on('keydown', preventDelete.checkEvent)
    ed.on('BeforeExecCommand', function (e) {
      if (e.command === 'Cut' || e.command === 'Delete' || e.command === 'Paste') {
        return preventDelete.checkEvent(e)
      }
      return true
    })
    ed.on('BeforeSetContent', function (e) {
      return preventDelete.checkEvent(e)
    })
  })
})()
