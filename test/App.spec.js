import App from '../src/App';

describe('App', () => {
  it('initializes', () => {
    const el = document.createElement('div');
    const app = new App({ el });
    expect(app).toBeInstanceOf(App);
  });
});
