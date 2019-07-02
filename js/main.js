'use strict';
{
  // moment.jsを使用して時刻を整形
  function formMoment(ms) {
    return moment(ms).format('Y/M/D H:mm:ss');
  }
  // データを扱うクラス
  // メモの各情報をオブジェクト型で保持
  class Doc {
    constructor(docObj) {
      this.docObj = docObj;
    }
    data(key = '') {
      if (key) {
        return this.docObj[key];
      } else {
        return this.docObj;
      }
    }
    write(key, value) {
      this.docObj[key] = value;
      return this;
    }
    // newボタン押された時用 データの日時を新しくする
    refresh() {
      this.write('created', Date.now());
      this.write('updated', Date.now());
    }
    isEmpty() {
      if (this.docObj.subject === '' && this.docObj.content === '') {
        return true;
      }
      return false;
    }
  }
  // メモのリストに関するクラス
  // メモの内容をオブジェクト型で保持（Docクラスを継承）
  // リストの要素生成とレンダリング
  class ListItem extends Doc {
    constructor(docObj, app) {
      super(docObj);
      this.app = app;
      this.isCurrent = false;
      this.el = null;
      this.createEl();
      this.setListener();
    }
    // current（今メモ本体に表示されているリスト）かどうか
    // 常にcurrentは一つ（falseにするのとtrueにするのはセットで）
    setIsCurrent(bool) {
      this.isCurrent = bool;
      const deleteBtn = this.el.querySelector('.item-delete-btn');
      if (bool) {
        this.el.classList.add('current');
        deleteBtn.style.display = 'none';
      } else {
        this.el.classList.remove('current');
        deleteBtn.style.display = 'flex';
      }
    }
    createEl() {
      this.el = document.createElement('li');
      this.el.classList.add('list-item-container');
      const listItem = document.createElement('div');
      listItem.classList.add('list-item');
      // listItem > subject, updated
      const subject = document.createElement('p');
      subject.classList.add('list-item-subject');
      subject.textContent = this.data('subject');
      const updated = document.createElement('p');
      updated.classList.add('list-item-updated');
      updated.textContent = formMoment(this.data('updated'));
      listItem.appendChild(subject);
      listItem.appendChild(updated);
      // li > listItem, deleteBtn
      const deleteBtn = document.createElement('div');
      deleteBtn.classList.add('item-delete-btn');
      deleteBtn.innerHTML = '&times;';
      this.el.appendChild(listItem);
      this.el.appendChild(deleteBtn);
      return this.el;
    }
    getEl() {
      return this.el;
    }
    render() {
      const subEl = this.el.querySelector('.list-item-subject');
      const updEl = this.el.querySelector('.list-item-updated');
      subEl.textContent = this.data('subject');
      if (subEl.textContent === '') {
        subEl.textContent = '(untitled)';
      }
      if (subEl.textContent.length > 13) {
        const text = subEl.textContent.slice(0, 12) + '...';
        subEl.textContent = text;
      }
      updEl.textContent = formMoment(this.data('updated'));
    }
    setListener() {
      // タイトルの方がクリックされた時
      // firestoreに書き込みなど
      const list = this.el.querySelector('.list-item');
      list.addEventListener('click', e => {
        e.preventDefault();
        // Currentだった場合＝何もしない
        if (this.isCurrent === true) {
          this.app.closeList();
          return;
        }
        // Currentが空の場合＝firestoreに書き込まずにリストの順序を入れ替え
        if (this.app.getCurrentItem().isEmpty()) {
          this.write('updated', Date.now());
          this.app.replaceItem(this);
          this.app.closeList();
          return;
        }
        // Currentが空でない場合＝firestoreに書き込んで入れ替え
        this.app.writeFirestore(this, () => {
          this.write('updated', Date.now());
          this.app.replaceItem(this);
          this.app.closeList();
        });
      });
      // 削除ボタンがクリックされた時
      // 自分を渡してListBoxのListItemsの配列から削除する
      const deleteBtn = this.el.querySelector('.item-delete-btn');
      deleteBtn.addEventListener('click', e => {
        e.preventDefault();
        this.app.deleteItem(this);
      });
    }
  }

  // リスト一覧の表示に関するクラス
  // Listクラスのインスタンスを配列で保持
  // 配列に従ってレンダリングする
  class ListBox {
    constructor(app) {
      this.app = app;
      this.listItems = [];
      this.boxHeight = 0;
      this.listContainer = document.getElementById('list-box-container');
      this.currentBox = document.getElementById('current-list-box');
      this.subBox = document.getElementById('sub-list-box');
      this.openBtn = document.getElementById('list-open-btn');
      this.closeBtn = document.getElementById('list-close-btn');
      this.mask = document.getElementById('mask');
      this.setListener();
    }
    getListItems() {
      return this.listItems;
    }
    clear() {
      this.listItems = [];
    }
    append(item) {
      // 後ろに入れる
      this.listItems = [...this.listItems, item];
      return this;
    }
    prepend(item) {
      // 前に入れる
      this.listItems = [item, ...this.listItems];
      return this;
    }
    replace(item) {
      // 空のListItemがあれば除去
      this.listItems = this.listItems.filter(v => !v.isEmpty());
      // itemを先頭にする
      this.listItems = this.listItems.filter(
        v => v.data('id') !== item.data('id')
      );
      this.listItems = [item, ...this.listItems];
      return this;
    }
    delete(item) {
      this.listItems = this.listItems.filter(
        v => v.data('id') !== item.data('id')
      );
      return this;
    }
    deleteAllItems() {
      // 全てのListItem要素を消す
      while (this.currentBox.firstChild) {
        this.currentBox.removeChild(this.currentBox.firstChild);
      }
      while (this.subBox.firstChild) {
        this.subBox.removeChild(this.subBox.firstChild);
      }
    }
    renderItems() {
      this.deleteAllItems();
      // 描画
      this.listItems.forEach((item, index) => {
        const parentNode = index !== 0 ? this.subBox : this.currentBox;
        parentNode.appendChild(item.getEl());
        item.render();
      });
    }
    render() {
      this.subBox.style.maxHeight = 'none';
      this.renderItems();
      const listContainerH = this.listContainer.offsetHeight;
      const currentBoxH = this.currentBox.offsetHeight;
      const subBoxH = this.subBox.offsetHeight;

      // listContainerH - 28 : 上下のpadding(各14px)
      // currentBoxH + 21 : 下のmargin
      // subBoxH + 7 : 下のmargin
      const isScroll = currentBoxH + 21 + subBoxH + 7 >= listContainerH - 28;
      // max-heightの設定
      this.subBox.style.maxHeight = `${listContainerH -
        28 -
        currentBoxH -
        21}px`;
      if (isScroll) {
        if (!this.subBox.classList.contains('scroll')) {
          this.subBox.classList.add('scroll');
          this.renderItems();
        }
      } else {
        if (this.subBox.classList.contains('scroll')) {
          this.subBox.classList.remove('scroll');
          this.renderItems();
        }
      }
    }
    // スマホ専用（スマホではリスト一覧が左からスライド）
    open() {
      this.listContainer.classList.remove('slide');
      this.mask.classList.remove('hidden');
      this.openBtn.classList.add('hidden');
      this.closeBtn.classList.remove('hidden');
    }
    close() {
      this.listContainer.classList.add('slide');
      this.mask.classList.add('hidden');
      this.openBtn.classList.remove('hidden');
      this.closeBtn.classList.add('hidden');
    }
    setListener() {
      this.openBtn.addEventListener('click', e => {
        e.preventDefault();
        this.open();
      });
      this.closeBtn.addEventListener('click', e => {
        e.preventDefault();
        this.close();
      });
      this.mask.addEventListener('click', e => {
        e.preventDefault();
        this.close();
      });
    }
  }
  // メモの内容を表示するクラス
  // Appクラスに保持されているcurrentのListItemの内容を表示する
  // 入力ごとに更新日やリスト項目の内容を更新
  class Memo {
    constructor(item, app) {
      this.item = item;
      this.app = app;
      this.subjectEl = document.getElementById('memo-subject');
      this.contentEl = document.getElementById('memo-content');
      this.createdEl = document.getElementById('memo-created');
      this.updatedEl = document.getElementById('memo-updated');
      this.setListener();
    }
    set(item) {
      this.item = item;
      return this;
    }
    clear() {
      this.subjectEl.value = '';
      this.contentEl.value = '';
      this.createdEl.textContent = '';
      this.updatedEl.textContent = '';
    }
    render() {
      this.subjectEl.value = this.item.data('subject');
      this.contentEl.value = this.item.data('content');
      this.createdEl.textContent = formMoment(this.item.data('created'));
      this.updatedEl.textContent = formMoment(this.item.data('updated'));
    }
    setListener() {
      this.subjectEl.addEventListener('input', () => {
        this.item.write('subject', this.subjectEl.value);
        this.item.write('updated', Date.now());
        this.item.render();
        this.render();
      });
      this.contentEl.addEventListener('input', () => {
        this.item.write('content', this.contentEl.value);
        this.item.write('updated', Date.now());
        this.render();
      });
    }
  }

  // メインクラス
  // 各クラスのインスタンスは全てメインクラスで行う
  // firebaseの設定、firestoreの読み書きもメインクラスが担う
  class App {
    constructor() {
      // firebaseの初期化
      this.initFirebase();
      this.db = firebase.firestore();
      this.auth = firebase.auth();
      this.me = null;
      this.memoCollection = null;
      this.currentItem = null;
      this.memo = null;
      this.listBox = new ListBox(this);
      this.loginBtn = document.getElementById('login-btn');
      this.logoutBtn = document.getElementById('logout-btn');
      this.newBtn = document.getElementById('memo-new-btn');
      this.saveBtn = document.getElementById('memo-save-btn');
      this.setListener();
    }
    initFirebase() {
      const firebaseConfig = {
        apiKey: '',
        authDomain: '',
        databaseURL: '',
        projectId: '',
        storageBucket: '',
        messagingSenderId: '',
        appId: ''
      };
      firebase.initializeApp(firebaseConfig);
    }
    // ログイン状態になったら実行
    initApp(userId) {
      this.memoCollection = this.db.collection(userId);
      this.listBox.clear();
      this.loadFirestore();
    }
    // firestoreのコレクションから読み込んで表示
    loadFirestore() {
      this.memoCollection
        .orderBy('updated', 'desc')
        .get()
        .then(snapShot => {
          // 一番先頭に新規ListItemを作成
          const newDocObj = manualDocObj;
          this.currentItem = new ListItem(newDocObj, this);
          this.currentItem.setIsCurrent(true);
          this.listBox.append(this.currentItem);
          // データベースから読み込んでListItemを作成して後ろに入れる
          snapShot.forEach(doc => {
            const item = new ListItem(doc.data(), this);
            this.listBox.append(item);
          });
          if (this.memo === null) {
            this.memo = new Memo(this.currentItem, this);
          }
          this.memo.set(this.currentItem).render();
          this.listBox.render();
        })
        .catch(err => {
          console.log('error: ', err);
        });
    }
    // firestoreに指定したListItemのデータを書き込む
    writeFirestore(item, resolve) {
      this.memoCollection
        .doc(item.data('id'))
        .set(item.data())
        .then(() => {
          // 書き込み成功
          resolve();
        })
        .catch(err => {
          // 書き込み失敗
          console.log('error: ', err);
        });
    }
    // firestoreから指定したListItemのデータを消す
    deleteFirestore(item, resolve) {
      this.memoCollection
        .doc(item.data('id'))
        .delete()
        .then(() => {
          // 削除成功
          resolve();
        })
        .catch(err => {
          // 削除失敗
          console.log('error: ', err);
        });
    }
    setListener() {
      // メモの新規作成
      this.newBtn.addEventListener('click', e => {
        e.preventDefault();
        if (this.newBtn.classList.contains('disabled')) {
          return;
        }
        if (this.currentItem.isEmpty()) {
          // もしタイトルも内容も空ならば書き込みも新規作成もしない
          this.currentItem.refresh();
          this.memo.render();
          this.currentItem.render();
          return;
        }
        this.writeFirestore(this.currentItem, () => {
          // firestoreへの書き込みが成功したら新しいItemをCurrentにセット
          const newDocObj = {
            id: Date.now().toString(32),
            subject: '',
            content: '',
            created: Date.now(),
            updated: Date.now()
          };
          this.currentItem.setIsCurrent(false); // 前のCurrentItem
          this.currentItem = new ListItem(newDocObj, this);
          this.currentItem.setIsCurrent(true); // 新しいCurrentItem
          this.listBox.prepend(this.currentItem).render();
          this.memo.set(this.currentItem).render();
        });
      });
      // メモの保存
      this.saveBtn.addEventListener('click', e => {
        e.preventDefault();
        if (
          this.saveBtn.classList.contains('disabled') ||
          this.currentItem.isEmpty()
        ) {
          return;
        }
        this.writeFirestore(this.currentItem, () => {});
      });
      // ログイン
      this.loginBtn.addEventListener('click', () => {
        this.auth.signInAnonymously();
      });
      // ログアウト
      this.logoutBtn.addEventListener('click', e => {
        this.listBox.getListItems().forEach(item => {
          this.deleteFirestore(item, () => {});
        });
        // ドキュメントが全て削除されるまでログアウトを待つ
        // （暫定）
        window.setTimeout(() => {
          this.auth.signOut();
          this.memo.clear();
          this.listBox.deleteAllItems();
        }, 0);
      });
      // ログインの状態の監視
      this.auth.onAuthStateChanged(user => {
        if (user) {
          // ログイン中
          this.me = user;
          this.loginBtn.classList.add('hidden');
          this.logoutBtn.classList.remove('hidden');
          this.newBtn.classList.remove('disabled');
          this.saveBtn.classList.remove('disabled');
          this.initApp(this.me.uid);
        } else {
          // ログアウト中
          this.me = null;
          this.loginBtn.classList.remove('hidden');
          this.logoutBtn.classList.add('hidden');
          this.newBtn.classList.add('disabled');
          this.saveBtn.classList.add('disabled');
        }
      });
    }
    // ListItemのcurrentの入れ替え
    replaceItem(item) {
      this.currentItem.setIsCurrent(false);
      this.currentItem = item;
      this.currentItem.setIsCurrent(true);
      this.listBox.replace(this.currentItem).render();
      this.memo.set(this.currentItem).render();
    }
    deleteItem(item) {
      this.deleteFirestore(item, () => {
        this.listBox.delete(item).render();
      });
    }
    closeList() {
      this.listBox.close();
    }
    getCurrentItem() {
      return this.currentItem;
    }
  }

  // マニュアル用DocObj
  const manualDocObj = {
    id: Date.now().toString(32),
    subject: '使い方 ver0.1',
    content: `右上（＋）：メモの新規作成
右下（保存）：今書いているメモを上書きでオンラインデータベースに保存
左：メモの一覧
　メモを編集したい時はタイトルをクリック
　削除したい時は右の（x）をクリック

リスト一覧からメモを選択すると、今編集中のメモは自動的にオンラインデータベースに保存されます。
ログアウトすると全てのメモはデータベース上から削除されます。
ログイン毎に別のidに基づいた新しいデータベースが作成されます。
既知の問題：
　safariで日本語でタイトルを入力した時に文字が重複する。（調査中）
　英字での入力は問題ありません。
更新：2019/7/2`,
    created: Date.now(),
    updated: Date.now()
  };

  window.onload = () => {
    if (window.innerWidth < 768) {
      // --screen-height 初期設定：700px+header28px
      // 幅768px未満の時はwindow.innerHeightに合わせる
      document.documentElement.style.setProperty(
        '--screen-height',
        `${window.innerHeight}px`
      );
    }
    const app = new App();
  };
}
