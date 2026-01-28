process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'myapp_test';
// or
process.env.DATABASE_URL = 'mysql://localhost/myapp_test';

const request = require('supertest');
const app = require('../service');
const db = require('../database/database');

const testAdmin = { name: 'pizza franchisee', email: 'franchise@test.com', password: 'a', roles: [{ role: 'admin' }] };
// const regularUser = { name: 'pizza please', email: 'email@test.com', password: 'b' };

let adminAuthToken;

beforeAll(async () => {
    // make email unique per test run
    testAdmin.email = Math.random().toString(36).substring(2, 12) + '@test.com';
    try {
        await db.DB.addUser(testAdmin);
    } catch (err) {
        console.log(err);
    }

    // login admin user
    // const registerRes = await request(app).post('/api/auth').send(testAdmin);
    const loginRes = await request(app).put('/api/auth').send(testAdmin);

    adminAuthToken = loginRes.body.token;

    // create a franchise to use in tests
    const franchiseRes = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send({
            name: 'pizzaPocket',
            admins: [{ email: testAdmin.email }],
        });
    // expect(franchiseRes.status).toBe(200);
    console.log(franchiseRes.body);
});

test('get franchises', async () => {
  const franchiseList = await request(app).get('/api/franchise?page=0&limit=10&name=*');
  expect(franchiseList.status).toBe(200);
  console.log(franchiseList.body.id);
});